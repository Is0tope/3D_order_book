import BinanceFeedHandler from './feedhandlers/BinanceFeedHandler'
import { BitMEXFeedhandler } from './feedhandlers/BitMEXFeedHandler'
import { FeedHandler, OrderBookEvent, OrderBookEventHandler, TickerEvent, TickerEventHandler, TradeEvent, TradeEventHandler } from './feedhandlers/Feedhandler'
import { FTXFeedHandler } from './feedhandlers/FTXFeedHandler'
import KrakenFeedHandler from './feedhandlers/KrakenFeedHandler'
import MangoFeedHandler from './feedhandlers/MangoFeedhandler'

export class FeedManager {
    private _feedhandlers: Map<string,FeedHandler> = new Map()
    private _orderBookEventHandlers: OrderBookEventHandler[] = []
    private _tradeEventHandlers: TradeEventHandler[] = []
    private _tickerEventHandlers: TickerEventHandler[] = []
    
    private _exchange: string | undefined
    private _symbol: string | undefined

    constructor() {
        this.registerFeedhandler(new FTXFeedHandler())
        this.registerFeedhandler(new MangoFeedHandler())
        this.registerFeedhandler(new BitMEXFeedhandler())
        this.registerFeedhandler(new BinanceFeedHandler())
        this.registerFeedhandler(new KrakenFeedHandler())
    }

    private registerFeedhandler(fh: FeedHandler) {
        const exchange = fh.getExchange()
        if(this._feedhandlers.has(exchange)) {
            return new Error(`exchange: ${exchange} is already registered`)
        }
        // Feed manager acts as passthrough for upstream feed handlers
        fh.onOrderBookEvent((event: OrderBookEvent) => this.publishOrderBookEvent(event))
        fh.onTradeEvent((event: TradeEvent) => this.publishTradeEvent(event))
        fh.onTickerEvent((event: TickerEvent) => this.publishTickerEvent(event))
        this._feedhandlers.set(exchange,fh)
    }

    private publishOrderBookEvent(event: OrderBookEvent) {
        this._orderBookEventHandlers.forEach((fn) => fn(event))
    }

    private publishTradeEvent(event: TradeEvent) {
        this._tradeEventHandlers.forEach((fn) => fn(event))
    }

    private publishTickerEvent(event: TickerEvent) {
        this._tickerEventHandlers.forEach((fn) => fn(event))
    }

    onOrderBookEvent(fn: OrderBookEventHandler) {
        this._orderBookEventHandlers.push(fn)
    }

    onTradeEvent(fn: TradeEventHandler) {
        this._tradeEventHandlers.push(fn)
    }

    onTickerEvent(fn: TickerEventHandler) {
        this._tickerEventHandlers.push(fn)
    }

    disconnect() {
        if(this._exchange === undefined) return
        const fh = this._feedhandlers.get(this._exchange)
        fh?.disconnect()
    }

    connect(exchange: string, symbol: string) {
        const fh = this._feedhandlers.get(exchange)
        if(!fh) {
            throw new Error(`${exchange} does is not a managed feed`)
        }
        this._exchange = exchange
        this._symbol = symbol
        fh.connect(this._symbol)
    }
}