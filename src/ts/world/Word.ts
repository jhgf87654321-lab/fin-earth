import {
  MeshBasicMaterial, PerspectiveCamera,
  Raycaster, Scene, ShaderMaterial, Vector2, WebGLRenderer
} from "three";
import {
  OrbitControls
} from "three/examples/jsm/controls/OrbitControls";

// interfaces
import { IWord } from '../interfaces/IWord'

import { Basic } from './Basic'
import Sizes from '../Utils/Sizes'
import { Resources } from './Resources';

// earth 
import Earth from './Earth'
import Data from './Data'
import { cities } from './cities'
import { NewsSidebar } from '../news/sidebar'

export default class World {
  public basic: Basic;
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer
  public controls: OrbitControls;
  public sizes: Sizes;
  public material: ShaderMaterial | MeshBasicMaterial;
  public resources: Resources;
  public option: IWord;
  public earth: Earth;
  public sidebar: NewsSidebar;
  private raycaster: Raycaster;
  private pointer: Vector2;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(option: IWord) {
    this.option = option

    this.basic = new Basic(option.dom)
    this.scene = this.basic.scene
    this.renderer = this.basic.renderer
    this.controls = this.basic.controls
    this.camera = this.basic.camera

    this.sizes = new Sizes({ dom: option.dom })
    this.raycaster = new Raycaster()
    this.pointer = new Vector2()

    this.sizes.$on('resize', () => {
      this.renderer.setSize(Number(this.sizes.viewport.width), Number(this.sizes.viewport.height))
      this.camera.aspect = Number(this.sizes.viewport.width) / Number(this.sizes.viewport.height)
      this.camera.updateProjectionMatrix()
    })

    this.sidebar = new NewsSidebar((cityId) => {
      if (this.earth) {
        this.earth.setActiveCity(cityId)
        if (cityId) {
          this.earth.isRotation = false
        } else {
          this.earth.isRotation = this.earth.options.earth.isRotation
        }
      }
    })

    this.resources = new Resources(async () => {
      await this.createEarth()
      this.bindPick()
      this.sidebar.startPolling(45000)
      this.syncNewsPulse()
      this.render()
    })
  }

  private syncNewsPulse() {
    const apply = () => {
      const payload = this.sidebar.getPayload()
      if (!payload || !this.earth) return
      const withNews = Object.keys(payload.byCity).filter(
        (id) => (payload.byCity[id] || []).length > 0
      )
      this.earth.setNewsCities(withNews)
    }
    apply()
    window.setInterval(apply, 2000)
  }

  async createEarth() {
    this.earth = new Earth({
      data: Data,
      cities,
      dom: this.option.dom,
      textures: this.resources.textures,
      earth: {
        radius: 50,
        rotateSpeed: 0.002,
        isRotation: true
      },
      satellite: {
        show: true,
        rotateSpeed: -0.01,
        size: 1,
        number: 2
      },
      punctuation: {
        circleColor: 0x3892ff,
        lightColumn: {
          startColor: 0xe4007f,
          endColor: 0xffffff,
        },
      },
      flyLine: {
        color: 0xf3ae76,
        flyLineColor: 0xff7714,
        speed: 0.004,
      }
    })

    this.scene.add(this.earth.group)

    await this.earth.init()

    const loading = document.querySelector('#loading')
    loading.classList.add('out')
  }

  private bindPick() {
    const canvas = this.renderer.domElement

    canvas.addEventListener('pointerdown', (ev) => {
      this.pointerDown = { x: ev.clientX, y: ev.clientY }
    })

    canvas.addEventListener('pointerup', (ev) => {
      if (!this.pointerDown || !this.earth) return
      const dx = ev.clientX - this.pointerDown.x
      const dy = ev.clientY - this.pointerDown.y
      this.pointerDown = null
      if (Math.hypot(dx, dy) > 6) return

      const rect = canvas.getBoundingClientRect()
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObjects(
        this.earth.markupPoint.children,
        true
      )
      if (!hits.length) {
        this.sidebar.selectCity(null)
        return
      }
      const cityId = this.earth.pickCityId(hits[0].object)
      if (cityId) {
        this.sidebar.selectCity(cityId)
      }
    })
  }

  public render() {
    requestAnimationFrame(this.render.bind(this))
    this.renderer.render(this.scene, this.camera)
    this.controls && this.controls.update()
    this.earth && this.earth.render()
  }
}
