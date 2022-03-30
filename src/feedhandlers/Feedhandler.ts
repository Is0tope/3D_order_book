import { OrderBookAction, PriceLevel, Side } from '../L2Book'


export type OrderBookEventHandler = (event: OrderBookEvent) => void
export type TradeEventHandler = (event: TradeEvent) => void

export interface BaseFeedHandler {
    onOrderBookEvent: (fn: OrderBookEventHandler) => void
    onTradeEvent: (fn: TradeEventHandler) => void
    connect: (symbol: string) => void
    disconnect: () => void
}

export interface OrderBookEvent {
    action: OrderBookAction,
    bids: PriceLevel[],
    asks: PriceLevel[]
}

export interface TradeEvent {
    price: number,
    size: number,
    side: Side
}

export class FeedHandler implements BaseFeedHandler{
    private _exchange: string
    private _symbol: string
    private _ws: WebSocket | undefined
    private _url: string
    private _connected: boolean
    private _orderBookEventHandlers: OrderBookEventHandler[] = []
    private _tradeEventHandlers: TradeEventHandler[] = []

    constructor(exchange: string, wsUrl: string) {
        this._url = wsUrl
        this._exchange = exchange
        this._connected = false
        this._symbol = ''
    }

    protected ws(): WebSocket {
        if(this._ws === undefined) {
            throw new Error('WebSocket must be first initiated using connect()')
        }
        return this._ws
    }
    
    // @override
    onOpen(event: Event) {
        throw Error('Not yet implemented')
    }

    // @override
    onMessage(event: MessageEvent) {
        throw Error('Not yet implemented')
    }

    onOrderBookEvent(fn: OrderBookEventHandler) {
        this._orderBookEventHandlers.push(fn)
    }

    onTradeEvent(fn: TradeEventHandler) {
        this._tradeEventHandlers.push(fn)
    }

    getExchange(): string {
        return this._exchange
    }

    getSymbol(): string {
        return this._symbol
    }

    connect(symbol: string) {
        console.log(`Connecting to ${this._exchange} WebSocket feed`)
        this._ws = new WebSocket(this._url)
        this._symbol = symbol
        this.ws().onopen = (event: Event) => {
            this.onOpen(event)
            this._connected = true
        }

        this.ws().onmessage = (e: MessageEvent) => {
            if(!this._connected) return
            this.onMessage(e)
        }
    }

    disconnect() {
        if(this._connected === false) return
        console.log(`Closing WebSocket connection to ${this._exchange}`)
        this.ws().close()
        this._ws = undefined
        this._connected = false
    }

    protected publishOrderBookEvent(event: OrderBookEvent) {
        this._orderBookEventHandlers.forEach((fn) => fn(event))
    }

    protected publishTradeEvent(event: TradeEvent) {
        this._tradeEventHandlers.forEach((fn) => fn(event))
    }
}