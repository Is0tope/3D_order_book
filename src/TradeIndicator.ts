import { Material, Mesh, MeshLambertMaterial, Scene, SphereGeometry } from 'three'
import { Side } from './L2Book'

export class TradeIndicator {
    private _price: number
    private _size: number
    private _side: Side
    private _mesh: Mesh
    private _scene: Scene

    constructor(scene: Scene, price: number, size: number, side: Side, radius: number) {
        this._price = price
        this._size = size
        this._side = side
        this._scene = scene

        const geometry = new SphereGeometry(radius, 16, 8);
        const material = new MeshLambertMaterial({ color: 0xebcf34 });
        this._mesh = new Mesh(geometry, material);
        this._scene.add(this._mesh);
    }

    destroy() {
        this._scene.remove(this._mesh)
        this._mesh.geometry.dispose();
        (this._mesh.material as Material).dispose()
    }

    setPosition(x: number, y: number, z: number) {
        this._mesh.position.x = x
        this._mesh.position.y = y
        this._mesh.position.z = z
    }

    getPrice(): number {
        return this._price
    }
}