// Web preview: AdMob is native-only, so ads render as nothing.
export function startAds() {}
export function markOpenedFromNotification() {}
export function adOnJobOpen(then?: () => void) {
  then?.();
}
export function adOnApply(then: () => void) {
  then();
}
export function BottomBanner() {
  return null;
}
export function InlineBanner() {
  return null;
}
export function NativeAdCard() {
  return null;
}
