import { BoxBufferGeometry, BoxGeometry, Camera, Color, InstancedMesh, Material, MeshLambertMaterial, Object3D, Renderer, Scene } from 'three'
import SpriteText from 'three-spritetext';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls'
import { TradeEvent } from './feedhandlers/Feedhandler'
import { L2Book, Side } from './L2Book'
import { TradeIndicator } from './TradeIndicator'
export type PriceLevelBox = Object3D

function roundDownToTick(tickSize: number, price: number): number {
    return tickSize * Math.floor(price / tickSize)
}

function roundToTick(tickSize: number, price: number): number {
    return tickSize * Math.round(price / tickSize)
}

export function getPrecision(num: number) {
    // e.g.
    // 0.0001 => -4
    // 100 => 2
    const decs = Math.floor(Math.log10(num))

    const precision = Math.max(-decs, 0)
    return precision
}

function precisionRound(num: number, precision: number) {
    var factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

function indexWindowAverage(arr: number[], index: number, size: number): number {
    let ma = 0
    let cnt = 0
    for(let i = -size;i <= size;i++) {
        const num = arr[index + i]
        if(num) {
            ma += num
            cnt++
        }
    }
    return ma / cnt
}

export enum CameraMode {
    Front = 'Front',
    XWing = 'X-Wing',
    FPS = 'FPS'
}

export class BookAnimation {
    private _book: L2Book
    private _numTicks: number
    private _tickSize: number
    private _precision: number
    private _depth: number
    private _cumulative: boolean
    private _scene: Scene
    private _renderer: Renderer
    private _levelWidth = 1
    private _levelDepth = 1
    private _sizeBox: InstancedMesh<BoxGeometry, Material> | undefined
    
    private _sizeMatrix: number[][] = []
    private _sideMatrix: Side[][] = []
    private _priceHistory: number[] = []
    private _text: SpriteText[] = []

    private _ticksPerLabel = 10
    private _numLabelsPerSide = 0
    private _numLabels = 0

    private _tradeBuffer: TradeEvent[] = []
    private _trades: TradeIndicator[][] = []

    private _bidColor = new Color(0x0abc41)
    private _askColor = new Color(0xe63d0f)
    private _emptyColor = new Color(0x333333)

    private _created = false
    private _drawable = true

    private _partialReceived = false
    private _scalingFactor = 1

    private _camera: Camera
    private _cameraMode = CameraMode.Front
    private _cameraXwingOffset = 0
    private _xwingSmoothingFactor = 5
    private _cameraFPSControls: FirstPersonControls

    constructor(scene: Scene, rederer: Renderer, camera: Camera, book: L2Book, numTicks: number, depth: number) {
        this._scene = scene
        this._renderer = rederer
        this._camera = camera
        this._book = book
        this._numTicks = numTicks
        this._tickSize = 0
        this._precision = 0
        this._depth = depth
        this._cumulative = true
        this._cameraXwingOffset = Math.round(this._depth / 2)
        
        this._cameraFPSControls = new FirstPersonControls(this._camera,this._renderer.domElement)
        this._cameraFPSControls.enabled = false
        this._cameraFPSControls.lookSpeed = 0.1;
        this._cameraFPSControls.movementSpeed = 40;
    }

    setTickSize(tickSize: number) {
        this._tickSize = tickSize
        this._precision = getPrecision(tickSize)
    }

    setCumulative(cumulative: boolean) {
        this._cumulative = cumulative
    }
    
    create() {
        console.log('Creating animation')
        this.setCameraMode(this._cameraMode)

        const boxGeometry = new BoxBufferGeometry(this._levelWidth,1,1)
        const boxMaterial = new MeshLambertMaterial({ color: 0xffffff })
        this._sizeBox = new InstancedMesh(boxGeometry, boxMaterial, 2 * this._numTicks * this._depth)
        this._scene.add(this._sizeBox)

        for(let i = 0;i < 2 * this._depth * this._numTicks;i++) {
            this._sizeBox.setColorAt(i,this._emptyColor)
        }

        this._numLabelsPerSide = Math.floor(this._numTicks / this._ticksPerLabel)
        this._numLabels = 1 + 2 * this._numLabelsPerSide
        for(let i = 0; i < this._numLabels; i ++) {
            const txt = new SpriteText('',2,'#ffffff')
            txt.position.z = 3
            txt.position.y = 1
            txt.position.x = (i - this._numLabelsPerSide) * this._levelWidth * this._ticksPerLabel
            if(i === this._numLabelsPerSide) {
                txt.fontWeight = 'bold'
            }
            this._scene.add(txt)
            this._text.push(txt)
        }

        this.reset()

        this._created = true
    }

    destroy() {
        if(!this._created){
            console.warn('Trying to destroy animation before it is created')
            return
        }
        console.log('Destroying animation')
        this.reset()
        this._scene.remove(this._sizeBox!)
        this._sizeBox!.geometry.dispose();
        (this._sizeBox!.material as Material).dispose()

        this._text.forEach((txt: SpriteText) => {
            this._scene.remove(txt)
            txt.geometry.dispose()
            txt.material.dispose()
        })
        this._text = []

        this._created = false
    }

    reset() {
        this._partialReceived = false
        this._scalingFactor = 1
        this._sizeMatrix = []
        this._sideMatrix = []
        this._priceHistory = []
        this._tradeBuffer = []

        while(this._trades.length > 0) {
            const toRemove = this._trades.pop()
            toRemove?.forEach((ti: TradeIndicator) => ti.destroy())
        }

        for(let i = 0;i < this._depth;i++) {
            this._sizeMatrix.push(Array(2 * this._numTicks).fill(0))
            this._sideMatrix.push(Array(2 * this._numTicks).fill(Side.Buy))
            this._trades.push([])
        }
        
        this.recalculate()
    }

    update() {
        if(!this._created) return
        this.recalculate()
        this.draw()
    }

    recalculate() {
        const bids = this._book.getBidsMap()
        const asks = this._book.getAsksMap()

        const bestBid = Math.max(...bids.keys())
        const bestAsk = Math.min(...asks.keys())

        const maxSize = Math.max(...bids.values(),...asks.values())

        let midPrice = 0
        // Mid is always rounded down to bid since best bid/ask can be right next to each other
        // and we do not have a cell for half way in between
        if(asks.size === 0 && asks.size  === 0) {
            midPrice = 0
        } else if(asks.size === 0) {
            midPrice = bestBid
        } else if(bids.size === 0) {
            midPrice = bestAsk - this._tickSize
        } else {
            midPrice = precisionRound(roundDownToTick(this._tickSize,(bestBid + bestAsk) / 2),this._precision)
        }

        // If we have got some data for the first time, calculate our scaling factor & reset our price history
        if(!this._partialReceived) {
            const allSizes = [...bids.values(),...asks.values()].filter((x: number) => x > 0)
            if(allSizes.length > 0) {
                const avgSize = allSizes.reduce((a, b) => a + b, 0) / allSizes.length
                this._scalingFactor = 1 / avgSize
                // If price history is all zero it means, that means we need to place mid price all the way down
                this._priceHistory = Array(this._depth).fill(midPrice)
                this._partialReceived = true
            }
        }

        // Update the price history
        this._priceHistory.unshift(midPrice)
        if(this._priceHistory.length > this._depth) {
            this._priceHistory.pop()
        }
        
        let cumBid = 0
        let cumAsk = 0
        const sizeSlice = []
        const sideSlice = []

        // We always align the slice to the new midPrice with extrema reaching out to +/- numTicks
        if(this._cumulative) {
            sizeSlice.push(...Array(2 * this._numTicks).fill(0))
            sideSlice.push(...Array(2 * this._numTicks).fill(Side.Buy))
            for(let i = 0;i < this._numTicks;i++) {
                // TODO: This is not quite right, should figure out a cleaner way to align
                const bid = precisionRound(midPrice - (i * this._tickSize),this._precision)
                const ask = precisionRound(midPrice + ((1 + i) * this._tickSize),this._precision)
                const bidSize = bids.get(bid) || 0
                const askSize = asks.get(ask) || 0
                cumBid += bidSize
                cumAsk += askSize
                sizeSlice[(this._numTicks - 1) - i] = this._scalingFactor * cumBid
                sideSlice[(this._numTicks - 1) - i] = Side.Buy
                sizeSlice[this._numTicks + i] = this._scalingFactor * cumAsk
                sideSlice[this._numTicks + i] = Side.Sell
            }
        } else {
            for(let i = -this._numTicks;i < this._numTicks;i++) {
                const price = precisionRound(midPrice + (i * this._tickSize),this._precision)
                // these should never overlap
                const size = (bids.get(price) || asks.get(price)) || 0
                sizeSlice.push(this._scalingFactor * size)
                // HACK: There should really be a 'None' side, but default to Buy since size will be 0 anyway
                const side = i <= 0 ? Side.Buy : Side.Sell
                sideSlice.push(side)
            }
        }

        // Append new slice, and remove old one at the end
        this._sizeMatrix.unshift(sizeSlice)
        this._sideMatrix.unshift(sideSlice)
        if(this._sizeMatrix.length > this._depth) {
            this._sizeMatrix.pop()
        }
        if(this._sideMatrix.length > this._depth) {
            this._sideMatrix.pop()
        }

        // Add new trades
        const tradeSlice = []
        for(const trade of this._tradeBuffer) {
            tradeSlice.push(new TradeIndicator(this._scene,trade.price,trade.size,trade.side,this._levelWidth))
        }
        this._trades.unshift(tradeSlice)
        if(this._trades.length > this._depth) {
            const toRemove = this._trades.pop()
            toRemove?.forEach((ti: TradeIndicator) => ti.destroy())
        }
        this._tradeBuffer = []
    }

    draw() {
        if(!this._drawable) return

        const midPrice = this._priceHistory[0]

        // Update all of the heights & offsets
        const dummy = new Object3D()
        for(let i = 0;i < this._depth;i++) {
            const horizontalOffset = this._levelWidth * Math.round((this._priceHistory[i] - midPrice) / this._tickSize)
            for(let j = 0;j < 2 * this._numTicks;j++) {
                const index = (2 * i * this._numTicks) + j

                dummy.position.x = horizontalOffset + (j - this._numTicks) * this._levelWidth
                dummy.position.z = -i * this._levelDepth

                const size = this._sizeMatrix[i][j]
                const side = this._sideMatrix[i][j]

                dummy.scale.y = size === 0 ? 0.0001 : size
                dummy.position.y = dummy.scale.y/2
                dummy.updateMatrix()
                this._sizeBox!.setMatrixAt(index,dummy.matrix)
                let color = this._emptyColor
                if(size > 0) {
                    color = side === Side.Buy ? this._bidColor : this._askColor
                }
                this._sizeBox!.setColorAt(index,color)
            }
        }
        this._sizeBox!.instanceMatrix.needsUpdate = true
        if(this._sizeBox!.instanceColor !== null) {
            this._sizeBox!.instanceColor.needsUpdate = true
        }

        // Update trades
        for(let i = 0;i < this._depth;i++) {
            const trades = this._trades[i]
            const horizontalOffset = this._levelWidth * (this._priceHistory[i] - midPrice) / this._tickSize
            for(const trade of trades) {
                // Figure out the trades position relative to the middle
                const price = this._priceHistory[i]
                const indexOffset = Math.round((trade.getPrice() - price)/this._tickSize)
                const x = horizontalOffset + this._levelWidth * indexOffset
                const y = this._sizeMatrix[i][this._numTicks + indexOffset]
                const z = -i * this._levelDepth
                trade.setPosition(x,y,z)
            }
        }

        // Update price labels
        for(let i = 0; i < this._numLabels; i ++) {
            const price = midPrice + ((i - this._numLabelsPerSide) * this._ticksPerLabel * this._tickSize)
            const txt = this._text[i].text = price.toLocaleString(undefined, { minimumFractionDigits: this._precision })
        }
    }

    setCameraMode(cameraMode: CameraMode) {
        this._cameraMode = cameraMode
        if(this._cameraMode === CameraMode.Front) {
            this._camera.position.x = 0
            this._camera.position.y = 40
            this._camera.position.z = (this._depth * this._levelDepth) / 14
            this._camera.lookAt(0,0,-this._depth / 6)
            this._cameraFPSControls.enabled = false

        }
        if(this._cameraMode === CameraMode.XWing) {
            this._camera.position.x = 0
            this._camera.position.y = 30
            this._camera.position.z = -this._cameraXwingOffset * this._levelDepth
            this._camera.lookAt(0,0,0)
            this._cameraFPSControls.enabled = false

        }
        if(this._cameraMode === CameraMode.FPS) {
            this._cameraFPSControls.enabled = true
        }
    }

    updateCamera(delta: number) {
        if(this._cameraMode === CameraMode.XWing) {
            const midPrice = this._priceHistory[0]
            const cameraPrice = indexWindowAverage(this._priceHistory,this._cameraXwingOffset,this._xwingSmoothingFactor)
            const cameraOffset = (cameraPrice - midPrice)/this._tickSize
            this._camera.position.x = cameraOffset * this._levelWidth
        }
        if(this._cameraMode === CameraMode.FPS) {
            this._cameraFPSControls.update(delta)
        }
    }

    addTrade(trade: TradeEvent) {
        this._tradeBuffer.push(trade)
    }

    setDrawable(drawable: boolean) {
        this._drawable = drawable
    }
}