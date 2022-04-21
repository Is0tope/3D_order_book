import { OrderBookAction, Side } from '../L2Book'
import { FeedHandler, OrderBookEvent, TradeEvent } from './Feedhandler'

export default class KrakenFeedHandler extends FeedHandler {

    constructor() {
        super('Kraken','wss://ws.kraken.com')
    }

    onOpen(event: Event) {
        const subscribeBook = {
            event: 'subscribe',
            subscription: {
                name: 'book',
                depth: 1000,
            },
            pair: [this.getSymbol()]
        }
        this.ws().send(JSON.stringify(subscribeBook))
        const subscribeTrades = {
            event: 'subscribe',
            subscription: {
                name: 'trade',
            },
            pair: [this.getSymbol()]
        }
        this.ws().send(JSON.stringify(subscribeTrades))
    }

    onMessage(event: MessageEvent) {
        const msg = JSON.parse(event.data as string)
        
        if (!Array.isArray(msg)) {
            return;
        }
        
        const [reqIds, data, typ, pair] = msg;
        
        if(`${typ}`.startsWith('book-')){
            this.handleOrderBookEvent(data)
        }
        if(typ === "trade") {
            this.handleTradeEvent(data)
        }
    }

    handleOrderBookEvent(data: any) {
        const isSnapshot = "as" in data || "bs" in data;

        if (isSnapshot) {
            const obSnapshotEvent: OrderBookEvent = {
                action: OrderBookAction.Partial,
                bids: (data.bs ?? []).map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])]),
                asks: (data.as ?? []).map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])])
            }
            this.publishOrderBookEvent(obSnapshotEvent)
        }
        else {
            const obUpdateEvent: OrderBookEvent = {
                action: OrderBookAction.Update,
                bids: (data.b ?? []).map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])]),
                asks: (data.a ?? []).map((x: any) => [Number.parseFloat(x[0]),Number.parseFloat(x[1])])
            }
            this.publishOrderBookEvent(obUpdateEvent)
        }
    }

    handleTradeEvent(data: any[]) {
        data.forEach(d => {
            const trade: TradeEvent = {
                price: Number.parseFloat(d[0]),
                size: Number.parseFloat(d[1]),
                side: d[3] === 'b' ? Side.Buy : Side.Sell
            }
            this.publishTradeEvent(trade)
        });
    }
}