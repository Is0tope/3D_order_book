import { OrderBookAction, Side } from '../L2Book'
import { FeedHandler, OrderBookEvent, TradeEvent } from './Feedhandler'

export default class MangoFeedHandler extends FeedHandler{

    constructor() {
        super('Mango','wss://api.mango-bowl.com/v1/ws')
    }

    onOpen(event: Event) {
        const subscribeL2 = {
            op: 'subscribe',
            channel: 'level2',
            markets: [this.getSymbol()]
        }
        this.ws().send(JSON.stringify(subscribeL2))
        const subscribeTrades = {
            op: 'subscribe',
            channel: 'trades',
            markets: [this.getSymbol()]
        }
        this.ws().send(JSON.stringify(subscribeTrades))
    }

    onMessage(event: MessageEvent) {
        const msg = JSON.parse(event.data as string)
        const typ = msg.type

        if(['l2snapshot','l2update'].includes(typ)){
            this.handleOrderBookEvent(msg)
        }
        if(['trade'].includes(typ)) {
            this.handleTradeEvent(msg)
        }
    }

    handleOrderBookEvent(msg: any) {
        const translatedEvent: OrderBookEvent = {
            action: msg.typ === 'l2snapshot' ? OrderBookAction.Partial : OrderBookAction.Update,
            bids: msg.bids.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])]),
            asks: msg.asks.map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])])
        }
        this.publishOrderBookEvent(translatedEvent)
    }

    handleTradeEvent(msg: any) {
        const trade: TradeEvent = {
            price: Number.parseFloat(msg.price),
            size: Number.parseFloat(msg.size),
            side: msg.side === 'buy' ? Side.Buy : Side.Sell
        }
        this.publishTradeEvent(trade)
    }
}