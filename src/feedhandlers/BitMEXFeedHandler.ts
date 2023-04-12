import { InstrumentRepository } from '../instruments'
import { OrderBookAction, Side } from '../L2Book'
import { FeedHandler, OrderBookEvent, TradeEvent } from './Feedhandler'

export class BitMEXFeedhandler extends FeedHandler{
    private _instruments = new InstrumentRepository()
    constructor() {
        super('BitMEX','wss://ws.bitmex.com/realtime')
    }

    onOpen(event: Event): void {
        this.ws().send(JSON.stringify({
            'op': 'subscribe', 
            'args': [`orderBookL2:${this.getSymbol()}`,`trade:${this.getSymbol()}`]
        }))
    }

    onMessage(event: MessageEvent): void {
        const data = JSON.parse(event.data.toString())
        if(data.table === 'orderBookL2') {
            return this.handleOrderBookEvent(data)
        }
        if(data.table === 'trade') {
            return this.handleTradeEvent(data)
        }
    }

    handleOrderBookEvent(data: any) {
        const action = data.action
        const bids: [number,number][] = []
        const asks: [number,number][] = []
        const instrument = this._instruments.getExchangeInstrument(this.getExchange(),this.getSymbol())
        for(const level of data.data) {
            const side = level.side == 'Buy' ? Side.Buy : Side.Sell
            const price = level.price
            const size = action === 'delete' ? 0 : level.size
            side === Side.Buy ? bids.push([price,size]) : asks.push([price,size])
        }
        const event: OrderBookEvent = {
            action: action === 'partial' ? OrderBookAction.Partial : OrderBookAction.Update,
            bids: bids,
            asks: asks
        }
        this.publishOrderBookEvent(event)
    }

    handleTradeEvent(data: any) {
        for(const t of data.data) {
            const trade: TradeEvent = {
                price: t.price,
                size: t.size,
                side: t.side === 'Buy' ? Side.Buy : Side.Sell
            }
            this.publishTradeEvent(trade)
        }
    }
}