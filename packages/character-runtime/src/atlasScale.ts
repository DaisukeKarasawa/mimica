/**
 * Shared skeleton binary scale for Rio atlas assets.
 *
 * Derived from Rio Spine export (CH0158_home skeleton) at 0.61 binary scale so
 * `SpineStageController` fitScale math matches the authored bounds. Used by
 * `extractAnimations.ts` (`binary.scale`) and runtime rendering
 * (`fitScale = max(w/(crop*ATLAS), h/(crop*ATLAS)); spine.scale = ATLAS * fitScale`).
 * Re-verify after re-exporting
 * skeleton/atlas from Spine Editor.
 */
export const ATLAS_SCALE = 0.61;
