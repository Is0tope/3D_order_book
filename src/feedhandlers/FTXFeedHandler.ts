import { L2Book, OrderBookAction, Side } from '../L2Book'
import { FeedHandler, OrderBookEvent, TradeEvent } from './Feedhandler'

export class FTXFeedHandler extends FeedHandler{
    constructor() {
        super('FTX','wss://ftx.com/ws/')
    }

    onOpen(event: Event): void {
        this.ws().send(JSON.stringify({
            op: 'subscribe',
            channel: 'orderbook',
            market: this.getSymbol()
        }))
        this.ws().send(JSON.stringify({
            op: 'subscribe',
            channel: 'trades',
            market: this.getSymbol()
        }))
    }

    onMessage(event: MessageEvent): void {
        const data = JSON.parse(event.data.toString())
        if(data.channel === 'orderbook') {
            return this.handleOrderBookEvent(data)
        }
        if(data.channel === 'trades') {
            return this.handleTradeEvent(data)
        }
    }

    handleOrderBookEvent(data: any) {
        const typ = data.type
        if(!['partial','update'].includes(typ)) return
        const event: OrderBookEvent = {
            action: typ === 'partial' ? OrderBookAction.Partial : OrderBookAction.Update,
            bids: data.data.bids,
            asks: data.data.asks
        }
        this.publishOrderBookEvent(event)
    }

    handleTradeEvent(data: any) {
        if(data.type !== 'update') return
        const trades = data.data.forEach((t: any) => {
            const trade: TradeEvent = {
                price: t.price,
                size: t.size,
                side: t.side === 'buy' ? Side.Buy : Side.Sell
            }
            this.publishTradeEvent(trade)
        })
    }
}