import './style.css'
import { BookAnimation } from './BookAnimation'
import Stats from 'three/examples/jsm/libs/stats.module'
import { L2Book } from './L2Book'
import { OrderBookEvent, TradeEvent } from './feedhandlers/Feedhandler'
import { FeedManager } from './FeedManager'
import { InstrumentRepository } from './instruments'
import { createGUI } from './Gui'
import { Clock, Color, Fog, HemisphereLight, PerspectiveCamera, PointLight, Scene, WebGLRenderer } from 'three'


// How often to update the animation
const UPDATE_PERIOD_MS = 50
const INITIAL_EXCHANGE = 'BitMEX'
const INITIAL_SYMBOL = 'XBTUSD'
const MAX_DEPTH = 400
const NUM_TICKS_PER_SIDE = 200

// Global objects
const clock = new Clock()
const scene = new Scene()
const camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 )
const instrumentRepository = new InstrumentRepository()
const book = new L2Book()
const feedManager = new FeedManager()

// Set up renderer to span entire window
const renderer = new WebGLRenderer()
renderer.setSize( window.innerWidth, window.innerHeight )
document.body.appendChild( renderer.domElement )

// Create animation of book with initial symbol & exchange
const initialInstrument = instrumentRepository.getExchangeInstrument(INITIAL_EXCHANGE,INITIAL_SYMBOL)
const animation = new BookAnimation(scene,renderer,camera,book,NUM_TICKS_PER_SIDE,MAX_DEPTH)
animation.setTickSize(initialInstrument.tickSize)
animation.create()

// Connect to initial symbol
feedManager.connect(INITIAL_EXCHANGE,INITIAL_SYMBOL)

// Add ambient light to provide general backgorund lighting
const ambient = new HemisphereLight( 0x999999 ); // soft white light
scene.add( ambient );

// Add a point light to add some shadows
const light = new PointLight( 0x999999, 1.1);
light.position.set( 0, 100, -100 );
scene.add(light);

// Set up fog to mask the matrix clipping out nicely
const backgroundColor = new Color(0x222222);
scene.background = backgroundColor
scene.fog = new Fog(backgroundColor, 0.9 * MAX_DEPTH, MAX_DEPTH);

// Add stats panel (for debugging)
const stats = Stats()
// document.body.appendChild(stats.dom)

// Feed trades into animation
feedManager.onTradeEvent((trade: TradeEvent) => {
    animation.addTrade(trade)
})

// Feed order book events into order book
feedManager.onOrderBookEvent((event: OrderBookEvent) => {
    book.applyOrderBookEvent(event)
})

// Update the animation periodically
setInterval(() => {
    animation.update()
},UPDATE_PERIOD_MS)

// Handle screen resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize( window.innerWidth, window.innerHeight )
}
window.addEventListener('resize', onWindowResize, false)

// Animation loop
function animate() {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    animation.updateCamera(delta)
    stats.update()
    renderer.render(scene, camera)
}
animate()


// Set up the GUI
const gui = createGUI(
    instrumentRepository,
    feedManager,
    animation,
    book,
    INITIAL_EXCHANGE,
    INITIAL_SYMBOL
)
gui.mount('#gui')