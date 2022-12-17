import { assert } from '@vue/compiler-core'
import { mapLinear } from 'three/src/math/MathUtils'
import { OrderBookEvent, TickerEvent } from './feedhandlers/Feedhandler'

export enum Side {
    Buy = 'buy',
    Sell = 'sell'
}

export enum OrderBookAction {
    Partial,
    Update,
    Ticker,
}

export type PriceLevel = [number,number]

export class L2Book {
    private _bids: Map<number,number> = new Map()
    private _asks: Map<number,number> = new Map()
    private _tickers: TickerEvent[] = []
    private _bids_with_tickers: Map<number,number> = new Map()
    private _asks_with_tickers: Map<number,number> = new Map()

    constructor() {

    }

    add(side: Side, price: number, size: number) {
        const map = side === Side.Buy ? this._bids : this._asks
        if(size === 0) {
            map.delete(price)
        } else {
            map.set(price,size)
        }
    }

    applyOrderBookEvent(event: OrderBookEvent) {
        if(event.action === OrderBookAction.Partial) {
            this.clear()
        }
        this._tickers.length = 0
        event.bids.forEach((x: PriceLevel) => this.add(Side.Buy,...x))
        event.asks.forEach((x: PriceLevel) => this.add(Side.Sell,...x))
    }

    applyTickerEvent(event: TickerEvent) {
        this._tickers.push(event)
        let bids = this.getAscending(this._bids)
        let asks = this.getDescending(this._asks)
        this._tickers.forEach((x: TickerEvent) => {
            // while this price is worse than the existing price...
            while (bids.length > 0 && bids[bids.length-1][0] > x.bid[0]) {
                bids.pop()
            }
            // if this price is better than the existing price...
            if (bids.length == 0 || bids[bids.length-1][0] < x.bid[0]) {
                bids.push(x.bid)
            // if this price is the same as the existing price...
            } else {
                bids[bids.length-1][1] = x.bid[1]
            }

            // while this price is worse than the existing price...
            while (asks.length > 0 && asks[asks.length-1][0] < x.ask[0]) {
                asks.pop()
            }
            // if this price is better than the existing price...
            if (asks.length == 0 || asks[asks.length-1][0] > x.ask[0]) {
                asks.push(x.ask)
            // if this price is the same as the existing price...
            } else {
                asks[asks.length-1][1] = x.ask[1]
            }
        })
        //console.log(bids)
        this._bids_with_tickers.clear()
        this._asks_with_tickers.clear()
        bids.forEach((x: [number,number]) => this._bids_with_tickers.set(x[0], x[1]))
        asks.forEach((x: [number,number]) => this._asks_with_tickers.set(x[0], x[1]))
    }

    getBids(): [number,number][] {
        return this.getDescending(this.getBidsMap())
    }

    getAsks(): [number,number][] {
        return this.getAscending(this.getAsksMap())
    }

    getDescending(xs: Map<number,number>): [number,number][] {
        const arr = [...xs.entries()]
        arr.sort((a: [number,number], b: [number,number]) => b[0] - a[0])
        return arr
    }

    getAscending(xs: Map<number,number>): [number,number][] {
        const arr = [...xs.entries()]
        arr.sort((a: [number,number], b: [number,number]) => a[0] - b[0])
        return arr
    }

    getBidsMap(): Map<number,number> {
        if (this._tickers.length > 0) return this._bids_with_tickers
        return this._bids
    }

    getAsksMap(): Map<number,number> {
        if (this._tickers.length > 0) return this._asks_with_tickers
        return this._asks
    }

    clear() {
        this._bids.clear()
        this._bids_with_tickers.clear()
        this._asks.clear()
        this._asks_with_tickers.clear()
        this._tickers.length = 0
    }
}