import type { ItemArt } from '../minigames/model'
import { ARRANGEMENTS, CANVAS, MOODS, SIZES, layout, type Settings } from './layout'

/** Shapes only, never text: the picture must not carry a group name or anything else about a person. */
export function drawCollage(ctx: CanvasRenderingContext2D, items: ItemArt[], settings: Settings, seed: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = MOODS[settings.mood].background
  ctx.fillRect(0, 0, CANVAS, CANVAS)
  layout(items.length, ARRANGEMENTS[settings.arrangement].id, SIZES[settings.size].factor, seed).forEach(({ x, y, scale }, i) => {
    ctx.setTransform(scale, 0, 0, scale, x, y)
    for (const path of items[i].paths) {
      ctx.fillStyle = path.fill
      ctx.fill(new Path2D(path.d))
    }
  })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
