import { OrderBookAction, Side } from '../L2Book'
import { FeedHandler, OrderBookEvent, TradeEvent } from './Feedhandler'

export default class BinanceFeedHandler extends FeedHandler{
    private _msgBuffer: any[]
    private _hasReceivedSOW: boolean

    constructor() {
        super('Binance','wss://stream.binance.com:9443/stream')
        this._msgBuffer = []
        this._hasReceivedSOW = false
    }

    resetBuffer() {
        this._msgBuffer = []
    }

    getMessagesAfterUpdateId(lastUpdateId: number): any[] {
        // From https://binance-docs.github.io/apidocs/spot/en/#diff-depth-stream
        const idx = this._msgBuffer.findIndex((x: any) => {
            const { U, u } = x
            return U <= lastUpdateId + 1 && u >= lastUpdateId + 1
        })
        if(idx == -1) {
            return []
        }
        return this._msgBuffer.slice(idx)
    }

    onOpen(event: Event): void {
        // Clear out state structures
        this.resetBuffer()
        // Reset SOW flag
        this._hasReceivedSOW = false
        // Subscribe to each symbol
        const payload = JSON.stringify({ 
            id: 1,
            method: "SUBSCRIBE",
            params: [
                `${this.getSymbol().toLowerCase()}@depth@100ms`,
                `${this.getSymbol().toLowerCase()}@trade`
            ]
        })
        this.ws().send(payload)
        setTimeout(async () => {
            const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${this.getSymbol()}&limit=5000`)
            const data = await response.json()

            const partial: OrderBookEvent = {
                action: OrderBookAction.Partial,
                bids: data.bids.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])]),
                asks: data.asks.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])])
            }
            this.publishOrderBookEvent(partial)
            const lastUpdateId = data.lastUpdateId
            const msgs = this.getMessagesAfterUpdateId(lastUpdateId)
            if(msgs.length > 0) {
                for(const m of msgs) {
                    this.publishOrderBookEvent(this.processDepthUpdateMessage(m))
                }
            }
            this._hasReceivedSOW = true
        },1000)
    }

    processDepthUpdateMessage(msg: any): OrderBookEvent {
        return {
            action: OrderBookAction.Update,
            bids: msg.b.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])]),
            asks: msg.a.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])])
        }
    }

    handleTradeMessage(msg: any) {
        if(!this._hasReceivedSOW) return
        this.publishTradeEvent({
            price: parseFloat(msg.data.p),
            size: parseFloat(msg.data.q),
            side: msg.data.m ? Side.Sell : Side.Buy // I think thats how you do it?
        })
    }

    handleDepthUpdateMessage(msg: any) {
        const data = msg.data
        if(this._hasReceivedSOW) {
            this.publishOrderBookEvent(this.processDepthUpdateMessage(data))
        } else {
            this._msgBuffer.push(data)
        }
    }

    onMessage(event: MessageEvent): void {
        const msg = JSON.parse(event.data as string)
        if(!('stream' in msg)) return
        if(msg.data.e === 'depthUpdate') {
            this.handleDepthUpdateMessage(msg)
        }
        if(msg.data.e === 'trade') {
            this.handleTradeMessage(msg)
        }
    }
}