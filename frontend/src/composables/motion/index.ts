/**
 * Motion / gesture composables implementing Apple "Designing Fluid Interfaces"
 * physics: interruptible springs, momentum projection + rubber-banding, and
 * 1:1 pointer dragging with release-velocity tracking.
 */
export { useSpring } from './useSpring'
export type { SpringOptions, UseSpringReturn } from './useSpring'

export { project, rubberband, nearestSnapPoint } from './useProjection'

export { usePointerDrag } from './usePointerDrag'
export type {
  PointerDragHandlers,
  PointerDragOptions,
  PointerDragMoveEvent,
  PointerDragEndEvent,
  UsePointerDragReturn
} from './usePointerDrag'
