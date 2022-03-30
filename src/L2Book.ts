import { OrderBookEvent } from './feedhandlers/Feedhandler'

export enum Side {
    Buy = 'buy',
    Sell = 'sell'
}

export enum OrderBookAction {
    Partial,
    Update,
}

export type PriceLevel = [number,number]

export class L2Book {
    private _bids: Map<number,number> = new Map()
    private _asks: Map<number,number> = new Map()

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
        event.bids.forEach((x: PriceLevel) => this.add(Side.Buy,...x))
        event.asks.forEach((x: PriceLevel) => this.add(Side.Sell,...x))
    }

    getBids(): [number,number][] {
        const arr = [...this._bids.entries()]
        arr.sort((a: [number,number], b: [number,number]) => b[0] - a[0])
        return arr
    }

    getAsks(): [number,number][] {
        const arr = [...this._asks.entries()]
        arr.sort((a: [number,number], b: [number,number]) => a[0] - b[0])
        return arr
    }

    getBidsMap(): Map<number,number> {
        return this._bids
    }

    getAsksMap(): Map<number,number> {
        return this._asks
    }

    clear() {
        this._bids.clear()
        this._asks.clear()
    }
}