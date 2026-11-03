import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { markLayout, Wordmark, type Frame } from "@/components/brand/mark";
import { BRAND } from "@/lib/brand";

const MARK = markLayout(72);
const WORDMARK_GAP = 14;

// The timeline, in ms from the first frame.
const RISE = 500;
const RISE_STAGGER = 100;
const COIN_AT = 600;
const COIN_DROP = 70;
const COIN_BOUNCE = 9;
const WORDMARK_AT = 950;
const WORDMARK_FOR = 350;
const HOLD_UNTIL = 1750;
const WAVE = 1100;
const WAVE_STAGGER = 150;
const WAVE_DEPTH = 0.15;
const FADE = 200;
const STRETCH = 420;
const REVEAL = 450;
const QUICK_FADE = 200;

const RISE_EASING = Easing.bezier(0.2, 0.9, 0.3, 1);
const STRETCH_EASING = Easing.bezier(0.7, 0, 0.3, 1);

// Once per cold start: coming back from the background keeps the JS alive, so this stays true.
let launched = false;

type Phase = "intro" | "holding" | "waving" | "settling" | "leaving" | "done";

/**
 * The launch animation ("rise and drop", then "the bar takes over"), on top of the app.
 * It starts on the same plain indigo as the native splash, which it hides on its first
 * frame. The bars rise, the coin drops, the name appears; if the app is still not `ready`
 * the bars wave until it is. Then the tall bar stretches over the whole screen in white, and
 * the white fades out as the app (the `children`) fades in. Reduce Motion: the static
 * logo until ready, then a short fade.
 */
export function Preloader({
  ready,
  onFinish,
  children,
}: {
  ready: boolean;
  onFinish?: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(() => (launched ? "done" : "intro"));
  const screen = useRef({ width: 0, height: 0 });
  const mark = useRef({ left: 0, top: 0 });

  const rise = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const coinY = useSharedValue(-COIN_DROP);
  const coinOpacity = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const fade = useSharedValue(1); // bar 1, bar 2, the coin and the name, on the way out
  const waveT = useSharedValue(0);
  const waveEnd = useSharedValue([Infinity, Infinity, Infinity]);
  const stretch = {
    left: useSharedValue(0),
    top: useSharedValue(0),
    width: useSharedValue(0),
    height: useSharedValue(0),
    radius: useSharedValue(0),
    shown: useSharedValue(0),
  };
  const cover = useSharedValue(1);
  const content = useSharedValue(launched ? 1 : 0);

  const finish = useCallback(() => {
    launched = true;
    setPhase("done");
    onFinish?.();
  }, [onFinish]);

  // 0–1300 ms: bars rise, the coin drops and bounces, the name appears. Then hold.
  useEffect(() => {
    if (phase !== "intro") return;
    if (reduceMotion) {
      rise.forEach((bar) => bar.set(1));
      coinY.set(0);
      coinOpacity.set(1);
      wordmark.set(1);
      setPhase("holding");
      return;
    }
    rise.forEach((bar, i) => {
      bar.set(withDelay(i * RISE_STAGGER, withTiming(1, { duration: RISE, easing: RISE_EASING })));
    });
    // Lands at 55% of 500 ms, bounces up at 72%, settles at 100%.
    coinY.set(
      withDelay(
        COIN_AT,
        withSequence(
          withTiming(0, { duration: 275, easing: Easing.in(Easing.quad) }),
          withTiming(-COIN_BOUNCE, { duration: 85, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }),
        ),
      ),
    );
    coinOpacity.set(withDelay(COIN_AT, withTiming(1, { duration: 275 })));
    wordmark.set(withDelay(WORDMARK_AT, withTiming(1, { duration: WORDMARK_FOR, easing: Easing.out(Easing.cubic) })));
    const timer = setTimeout(() => setPhase("holding"), HOLD_UNTIL);
    return () => clearTimeout(timer);
    // Runs once, on the first frame; the shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = useCallback(() => {
    setPhase("leaving");
    if (reduceMotion) {
      content.set(1);
      cover.set(
        withTiming(0, { duration: QUICK_FADE }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
      return;
    }
    const { width, height } = screen.current;
    const tall = MARK.bars[2];
    const from: Frame = {
      left: mark.current.left + tall.left,
      top: mark.current.top + tall.top,
      width: tall.width,
      height: tall.height,
    };
    stretch.left.set(from.left);
    stretch.top.set(from.top);
    stretch.width.set(from.width);
    stretch.height.set(from.height);
    stretch.radius.set(from.width / 2);
    const timing = { duration: STRETCH, easing: STRETCH_EASING };
    // Part 1: only the tall bar stays.
    fade.set(withTiming(0, { duration: FADE }));
    // Part 2, phase A: the tall bar reaches the top and bottom edges...
    stretch.shown.set(withDelay(FADE, withTiming(1, { duration: 0 })));
    stretch.top.set(withDelay(FADE, withTiming(0, timing)));
    stretch.height.set(withDelay(FADE, withTiming(height, timing)));
    // ...phase B: then both sides, and loses its round ends.
    stretch.left.set(withDelay(FADE + STRETCH, withTiming(0, timing)));
    stretch.width.set(withDelay(FADE + STRETCH, withTiming(width, timing)));
    stretch.radius.set(withDelay(FADE + STRETCH, withTiming(0, timing)));
    // The screen is now white: the overlay fades out as the app fades in.
    cover.set(withDelay(FADE + STRETCH * 2, withTiming(0, { duration: REVEAL, easing: Easing.out(Easing.cubic) })));
    content.set(
      withDelay(
        FADE + STRETCH * 2,
        withTiming(1, { duration: REVEAL, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      ),
    );
    // Shared values and the frames are read when this runs, not captured for later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, finish]);

  // From 1750 ms: leave as soon as the app is ready; until then, the bars wave.
  useEffect(() => {
    if (phase === "holding" && ready) leave();
    else if (phase === "holding") {
      setPhase("waving");
      waveT.set(0);
      waveT.set(withTiming(WAVE * 1000, { duration: WAVE * 1000, easing: Easing.linear }));
    } else if (phase === "waving" && ready) {
      // Each bar finishes the cycle it is in and rests at full height; then leave.
      setPhase("settling");
      const now = waveT.get();
      const ends = [0, 1, 2].map((i) => {
        const local = now - i * WAVE_STAGGER;
        return i * WAVE_STAGGER + Math.max(0, Math.ceil(local / WAVE)) * WAVE;
      });
      const last = Math.max(...ends);
      waveEnd.set(ends);
      cancelAnimation(waveT);
      waveT.set(
        withTiming(last, { duration: Math.max(0, last - now), easing: Easing.linear }, (done) => {
          if (done) scheduleOnRN(leave);
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready, leave]);

  const contentStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 10 }],
  }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value * fade.value,
    transform: [{ translateY: coinY.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value * fade.value,
    transform: [{ translateY: (1 - wordmark.value) * 6 }],
  }));
  const stretchStyle = useAnimatedStyle(() => ({
    opacity: stretch.shown.value,
    left: stretch.left.value,
    top: stretch.top.value,
    width: stretch.width.value,
    height: stretch.height.value,
    borderRadius: stretch.radius.value,
  }));

  const onRootLayout = (event: LayoutChangeEvent) => {
    screen.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
    // The first frame is on screen, and it looks like the native splash: hand over.
    void SplashScreen.hideAsync();
  };
  const onMarkLayout = (event: LayoutChangeEvent) => {
    mark.current = { left: event.nativeEvent.layout.x, top: event.nativeEvent.layout.y };
  };

  if (phase === "done") return <>{children}</>;

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={contentStyle}>{children}</Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: BRAND.indigo }, coverStyle]}
        onLayout={onRootLayout}
        pointerEvents="none"
        accessible
        accessibilityLabel="ibudgi"
      >
        <StatusBar style="light" />
        {/* The mark is centred; the name hangs below it, so the mark sits where the splash would. */}
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <View style={{ width: MARK.width, height: MARK.height }} onLayout={onMarkLayout}>
            {MARK.bars.map((frame, i) => (
              <Bar
                key={i}
                index={i}
                frame={frame}
                rise={rise[i]}
                fade={fade}
                waveT={waveT}
                waveEnd={waveEnd}
                hide={i === 2 ? stretch.shown : undefined}
              />
            ))}
            <Animated.View
              style={[
                { position: "absolute", ...MARK.coin, borderRadius: MARK.coin.width / 2, backgroundColor: BRAND.coral },
                coinStyle,
              ]}
            />
            <Animated.View
              style={[
                { position: "absolute", top: MARK.height + WORDMARK_GAP, left: -100, right: -100, alignItems: "center" },
                wordmarkStyle,
              ]}
            >
              <Wordmark color={BRAND.white} />
            </Animated.View>
          </View>
        </View>
        <Animated.View style={[{ position: "absolute", backgroundColor: BRAND.white }, stretchStyle]} />
      </Animated.View>
    </View>
  );
}

/** One white bar: rises, waves while the app loads, and fades on the way out (not the tall one). */
function Bar({
  index,
  frame,
  rise,
  fade,
  waveT,
  waveEnd,
  hide,
}: {
  index: number;
  frame: Frame;
  rise: SharedValue<number>;
  fade: SharedValue<number>;
  waveT: SharedValue<number>;
  waveEnd: SharedValue<number[]>;
  hide?: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(waveT.value, waveEnd.value[index]) - index * WAVE_STAGGER;
    const wave = t <= 0 ? 1 : 1 - (WAVE_DEPTH * (1 - Math.cos((2 * Math.PI * t) / WAVE))) / 2;
    return {
      opacity: hide ? 1 - hide.value : fade.value,
      transform: [{ scaleY: rise.value * wave }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", ...frame, borderRadius: frame.width / 2, backgroundColor: BRAND.white, transformOrigin: "bottom" },
        style,
      ]}
    />
  );
}
