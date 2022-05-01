import { App, createApp, watch } from 'vue'
import { BookAnimation, CameraMode } from './BookAnimation'
import { FeedManager } from './FeedManager'
import { Instrument, InstrumentRepository } from './instruments'
import { L2Book } from './L2Book'


export function createGUI(instrumentRepository: InstrumentRepository, feedManager: FeedManager, animation: BookAnimation, book: L2Book, initalExchange: string, initialSymbol: string): App {
    const gui = createApp({
        data() {
            return {
                expanded: true,
                exchanges: instrumentRepository.getExchanges(),
                currentExchange: initalExchange,
                symbols: instrumentRepository.getExchangeInstruments(initalExchange).map((ins: Instrument) => ins.symbol),
                currentSymbol: initialSymbol,
                isCumulative: true,
                cameraModes: [CameraMode.Front,CameraMode.XWing,CameraMode.FPS],
                currentCameraMode: CameraMode.Front
            }
        },

        watch: {
            currentExchange(newExchange) {
                this.symbols = instrumentRepository.getExchangeInstruments(newExchange).map((ins: Instrument) => ins.symbol)
                this.currentSymbol = this.symbols[0]
            },
            currentSymbol(newSymbol) {
                const ins = instrumentRepository.getExchangeInstrument(this.currentExchange,newSymbol)
                // When symbol is switched,
                feedManager.disconnect()
                book.clear()
                animation.reset()
                animation.draw()
                animation.setTickSize(ins.tickSize)
                feedManager.connect(this.currentExchange,newSymbol)
            },
            isCumulative(newCumulative) {
                animation.setCumulative(newCumulative)
            },
            currentCameraMode(newCameraMode) {
                animation.setCameraMode(newCameraMode)
            }
        },

        methods: {
            expand() {
                this.expanded = true
            },
            close() {
                this.expanded = false
            }
        }
    })
    return gui
}

