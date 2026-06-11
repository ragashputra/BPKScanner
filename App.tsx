import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  ScrollView, Image, ActivityIndicator,
  Platform, Animated, Pressable, Modal,
  StatusBar as RNStatusBar, Easing, FlatList,
  LayoutAnimation, Keyboard, PanResponder, BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScannerScreen from './ScannerScreen';
// ── RNGH + Reanimated (untuk ImagePreviewModal) ────────────────────────────
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation, cancelAnimation,
} from 'react-native-reanimated';

// New Architecture: LayoutAnimation sudah aktif by default — tidak perlu enable manual

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID     = '596727618114-m494mn8i75gfh9lon7cfu1sa4r6aoo0h.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = '596727618114-e1k1jg3shvusc5mboenr4egt8pcqi6f9.apps.googleusercontent.com';
const CLIENT_ID         = Platform.OS === 'android' ? ANDROID_CLIENT_ID : WEB_CLIENT_ID;
const ROMAN_MONTHS       = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const INDO_MONTHS        = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const KEY_UNIT           = '@bpk_unit_usaha';
const KEY_FOLDER         = '@bpk_folder_id';
const KEY_FOLDER_MONTH   = '@bpk_folder_month';
const KEY_ACCESS         = '@bpk_access_token';
const KEY_REFRESH        = '@bpk_refresh_token';
const KEY_EMAIL          = '@bpk_user_email';
const KEY_DARK           = '@bpk_dark_mode';
const KEY_HISTORY        = '@bpk_upload_history';
const KEY_LAST_MONTH     = '@bpk_last_seen_month'; // format: "YYYY-MM"

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
  revocationEndpoint:    'https://oauth2.googleapis.com/revoke',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface UploadRecord {
  id:        string;
  fileName:  string;
  noBpk:     string;
  unit:      string;
  photoCount:number;
  uploadedAt:string; // ISO string
  driveId?:  string;
}

// ─── Shared animation configs ─────────────────────────────────────────────────
const LA_SPRING = {
  duration: 280,
  create:  { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleXY },
  update:  { type: LayoutAnimation.Types.easeInEaseOut },
  delete:  { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};
// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const LIGHT = {
  // ── Stone & Sage · Light ──────────────────────────────
  bg:            '#F2F4EF',
  surface:       '#FFFFFF',
  surfaceAlt:    '#ECF0E8',
  border:        'rgba(61,107,74,0.13)',
  borderStrong:  'rgba(61,107,74,0.28)',
  inputBorder:   '#3D6B4A',
  text:          '#111A0E',
  textSub:       '#3A5234',
  textMuted:     '#748A6A',
  accent:        '#3D6B4A',
  accentSoft:    '#5A8B66',
  accentLight:   'rgba(61,107,74,0.09)',
  accentContrast:'#FFFFFF',
  accentOverlay: 'rgba(255,255,255,0.22)',
  accentSubText: 'rgba(255,255,255,0.78)',
  success:       '#2D8C52',
  successBg:     '#EEF8F2',
  successBorder: 'rgba(45,140,82,0.28)',
  danger:        '#C0392B',
  dangerBg:      '#FDF2F1',
  warning:       '#A87D0E',
  warningBg:     '#FDF8EC',
  infoBg:        '#EEF2EC',
  headerBg:      '#FFFFFF',
  tabBg:         '#FFFFFF',
  shadow:        'rgba(15,40,20,0.08)',
  cardShadow:    'rgba(15,40,20,0.05)',
  shimmerBase:   '#E2E7DC',
  shimmerHigh:   'rgba(255,255,255,0.75)',
};
const DARK = {
  // ── Stone & Sage · Dark (OLED) ────────────────────────
  bg:            '#0A0D09',
  surface:       '#131710',
  surfaceAlt:    '#1A1F17',
  border:        'rgba(163,184,153,0.12)',
  borderStrong:  'rgba(163,184,153,0.24)',
  inputBorder:   '#A3B899',
  text:          '#EDF2EA',
  textSub:       '#A5B49E',
  textMuted:     '#566350',
  accent:        '#A3B899',
  accentSoft:    'rgba(163,184,153,0.75)',
  accentLight:   'rgba(163,184,153,0.10)',
  accentContrast:'#0A0D09',
  accentOverlay: 'rgba(10,13,9,0.15)',
  accentSubText: 'rgba(10,13,9,0.60)',
  success:       '#6BBF8A',
  successBg:     '#0A1C10',
  successBorder: 'rgba(107,191,138,0.25)',
  danger:        '#E07B7B',
  dangerBg:      '#1A0A0A',
  warning:       '#D4A84B',
  warningBg:     '#160F00',
  infoBg:        '#0D1610',
  headerBg:      '#0A0D09',
  tabBg:         '#0A0D09',
  shadow:        'rgba(0,0,0,0.85)',
  cardShadow:    'rgba(0,0,0,0.55)',
  shimmerBase:   '#141B11',
  shimmerHigh:   'rgba(163,184,153,0.05)',
};

// ─── buildStyles — dipanggil 2x (sekali untuk LIGHT, sekali untuk DARK) ──────
// Hasilnya di-cache permanent di useMemo([]) → toggle hanya ganti pointer, zero rebuild
function buildStyles(C: typeof LIGHT) {
  return StyleSheet.create({
    safe: { flex:1, backgroundColor:C.bg },
    header: {
      paddingTop:10, paddingBottom:12, paddingHorizontal:16,
      backgroundColor:C.headerBg,
      borderBottomWidth:1, borderBottomColor:C.border,
      flexDirection:'row', alignItems:'center', justifyContent:'space-between', zIndex:100,
    },
    headerLogoWrap: {
      width:36, height:36, borderRadius:11, backgroundColor:C.accentLight,
      alignItems:'center', justifyContent:'center',
      borderWidth:1, borderColor:C.borderStrong, marginRight:9,
    },
    headerTitle: { fontSize:16, fontWeight:'700', color:C.text, letterSpacing:-0.3 },
    headerSub:   { fontSize:10.5, color:C.textMuted, fontWeight:'400', marginTop:1.5 },
    clockChip:   {
      paddingHorizontal:10, paddingVertical:5, borderRadius:10,
      backgroundColor:C.accentLight, borderWidth:1,
      borderColor:C.borderStrong, alignItems:'center',
    },
    clockText: { fontSize:13.5, fontWeight:'700', color:C.accent, letterSpacing:0.3 },
    dateText:  { fontSize:9.5, color:C.textMuted, fontWeight:'500', marginTop:1 },
    menuBtn:   {
      width:36, height:36, borderRadius:10, backgroundColor:C.surfaceAlt,
      alignItems:'center', justifyContent:'center',
      borderWidth:1, borderColor:C.border, marginLeft:6,
    },
    dropdown: {
      position:'absolute', top:88, right:14, minWidth:252,
      backgroundColor:C.surface, borderRadius:16,
      borderWidth:1, borderColor:C.border,
      shadowColor:C.shadow, shadowOffset:{width:0,height:10},
      shadowOpacity:1, shadowRadius:24, elevation:20,
      zIndex:200, overflow:'hidden',
    },
    dropdownIconWrap: {
      width:30, height:30, borderRadius:9,
      backgroundColor:C.accentLight, alignItems:'center', justifyContent:'center',
    },
    dropdownText:    { fontSize:14, fontWeight:'500', color:C.text, flex:1 },
    dropdownItem:    { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:14 },
    dropdownDivider: { height:1, backgroundColor:C.border, marginHorizontal:16 },
    tabBar: {
      flexDirection:'row', backgroundColor:C.tabBg,
      borderTopWidth:1, borderTopColor:C.border,
      paddingBottom: Platform.OS === 'ios' ? 24 : 8,
      paddingTop:10, paddingHorizontal:4,
    },
    tabLabel:       { fontSize:12, fontWeight:'500', color:C.textMuted },
    tabLabelActive: { fontSize:12, fontWeight:'700', color:C.accent },
    tabItem:        { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:5 },
    tabDot:         { width:5, height:5, borderRadius:2.5, backgroundColor:C.accent },
    scroll:   { flex:1, backgroundColor:C.bg },
    content:  { padding:14, gap:10, paddingBottom:32 },
    btnPrimary: {
      height:52, borderRadius:16, backgroundColor:C.accent,
      flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
    },
    btnPrimaryText: { color:C.accentContrast, fontWeight:'700', fontSize:15, letterSpacing:0.1 },
    btnSave: {
      height:42, paddingHorizontal:16, borderRadius:12,
      backgroundColor:C.accent, alignItems:'center', justifyContent:'center',
    },
    btnSaveText:  { color:C.accentContrast, fontWeight:'600', fontSize:13 },
    previewBox: {
      flex:1, height:42, borderRadius:12, paddingHorizontal:12,
      backgroundColor:C.accentLight, borderWidth:1,
      borderColor:C.borderStrong, justifyContent:'center',
    },
    previewLabel: { fontSize:9, fontWeight:'600', color:C.textMuted, textTransform:'uppercase', letterSpacing:1.1 },
    previewValue: { fontSize:12.5, fontWeight:'700', color:C.accent, letterSpacing:-0.1, marginTop:1 },
    unitSavedBox: {
      flex:1, height:42, borderRadius:12, paddingHorizontal:12,
      borderWidth:1, borderColor:C.successBorder, backgroundColor:C.successBg,
      flexDirection:'row', alignItems:'center', gap:8,
    },
    unitSavedText: { flex:1, fontSize:14, fontWeight:'700', color:C.success },
    photoBtn: {
      flex:1, height:44, borderRadius:12, borderWidth:1, borderColor:C.borderStrong,
      backgroundColor:C.surfaceAlt,
      flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
    },
    photoBtnText: { color:C.accent, fontWeight:'600', fontSize:13 },
    searchWrap: {
      flexDirection:'row', alignItems:'center', gap:10, height:46,
      borderRadius:14, borderWidth:1.5, borderColor:C.border,
      backgroundColor:C.surface, paddingHorizontal:12,
    },
    searchInput:  { flex:1, fontSize:14, fontWeight:'500', color:C.text, height:'100%' },
    historyCard: {
      backgroundColor:C.surface, borderRadius:14, borderWidth:1,
      borderColor:C.border, paddingVertical:12, paddingHorizontal:14,
      shadowColor:C.cardShadow, shadowOffset:{width:0,height:2},
      shadowOpacity:1, shadowRadius:8, elevation:2,
    },
    histFileName:   { fontSize:13.5, fontWeight:'700', color:C.text, letterSpacing:-0.2 },
    histMeta:       { fontSize:11.5, color:C.textSub, fontWeight:'400' },
    aboutInfoRow:   { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:18, paddingVertical:15 },
    aboutInfoLabel: { fontSize:11, color:C.textMuted, fontWeight:'400' },
    aboutInfoValue: { fontSize:14, fontWeight:'600', color:C.text, marginTop:2 },
    aboutFooter:    { textAlign:'center', fontSize:11.5, color:C.textMuted, lineHeight:20, paddingVertical:28 },
  });
}

// Tinggi item history card — konstanta tunggal yang dipakai oleh getItemLayout dan StyleSheet.
// Ubah di sini saja kalau layout card berubah (font scale, konten tambahan, dsb.)
const HISTORY_ITEM_HEIGHT = 78;
function ScaleBtn({ onPress, style, innerStyle, children, disabled = false, hitSlop }: {
  onPress: () => void; style?: any; innerStyle?: any;
  children: React.ReactNode; disabled?: boolean;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const scale = useRef(new Animated.Value(1)).current;

  // pressIn: 60ms — cukup untuk visible tapi tidak terasa lelet sebelum onPress fire
  const pressIn = useCallback(() => {
    scale.stopAnimation();
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 60,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, []);

  // pressOut: high-tension spring → snap balik dalam ~80ms, zero overshoot
  const pressOut = useCallback(() => {
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 30,   // 2*√200 ≈ 28.3 → friction 30 = overdamped, zero bounce, fast snap
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Pressable
      onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
      android_ripple={null}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, disabled && { opacity: 0.4 }]}>
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── FocusInput — auto border highlight on focus ──────────────────────────────
function FocusInput({ C, style, ...props }: { C: typeof LIGHT; style?: any; [k: string]: any }) {
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = useCallback(() => {
    borderAnim.stopAnimation();
    Animated.timing(borderAnim, {
      toValue: 1, duration: 110,
      easing: Easing.bezier(0.0, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
    props.onFocus?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onFocus]);
  const onBlur = useCallback(() => {
    borderAnim.stopAnimation();
    Animated.timing(borderAnim, {
      toValue: 0, duration: 110,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: false,
    }).start();
    props.onBlur?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onBlur]);

  const borderColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [C.border, C.inputBorder],
  });
  const bgColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [C.surfaceAlt, C.surface],
  });

  return (
    <Animated.View style={[
      { borderRadius: 12, borderWidth: 2, borderColor, backgroundColor: bgColor, overflow: 'hidden' },
      style,
    ]}>
      <TextInput
        {...props}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType={props.returnKeyType ?? 'done'}
        textBreakStrategy="simple"
        style={{
          height: 42, paddingHorizontal: 12,
          fontSize: 13.5, fontWeight: '600', color: C.text,
        }}
      />
    </Animated.View>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastConfig { message: string; type: ToastType; duration?: number; }

function ToastNotification({ config, dark, onHide }: {
  config: ToastConfig; dark: boolean; onHide: () => void;
}) {
  const C = dark ? DARK : LIGHT;
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;
  const swipeY     = useRef(new Animated.Value(0)).current;
  const dismissed  = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toastBg   = dark ? '#FFFFFF' : '#1A1A1A';
  const toastText = dark ? '#111111' : '#FFFFFF';

  const typeMeta: Record<ToastType, { icon: string; iconColor: string; border: string }> = {
    success: { icon: 'checkmark-circle',    iconColor: C.success,  border: C.success  },
    error:   { icon: 'close-circle',        iconColor: '#E53935',  border: '#E53935'  },
    warning: { icon: 'alert-circle',        iconColor: '#F59E0B',  border: '#F59E0B'  },
    info:    { icon: 'information-circle',  iconColor: dark ? C.accent : '#4A9B6A', border: dark ? C.accent : '#4A9B6A' },
  };
  const m = typeMeta[config.type];

  // ── dismiss: dipakai bersama oleh auto-timeout dan swipe ──
  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(swipeY,  { toValue: -72, duration: 200, easing: Easing.bezier(0.4, 0, 1, 1), useNativeDriver: true }),
    ]).start(onHide);
  }, [onHide]);

  // ── PanResponder: deteksi swipe ke atas ──
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, { dy }) => dy < -5,
      onPanResponderMove: (_, { dy }) => {
        if (dy < 0) swipeY.setValue(dy * 0.85); // sedikit resistance
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        // dismiss kalau drag cukup jauh ke atas atau velocity tinggi
        if (dy < -40 || vy < -0.6) {
          dismiss();
        } else {
          // belum cukup — snap back (critically damped, no bounce)
          Animated.spring(swipeY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 28 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 28 }).start();
      },
    })
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }),
    ]).start();
    timerRef.current = setTimeout(dismiss, config.duration ?? 2800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // gabung entry animation + swipe gesture
  const combinedY = Animated.add(translateY, swipeY);

  return (
    // box-none: area kosong sekitar toast tetap passthrough, toast sendiri touchable
    <View style={toastSt.overlay} pointerEvents="box-none">
      <Animated.View
        {...pan.panHandlers}
        style={[toastSt.box, {
          backgroundColor: toastBg,
          borderColor: m.border,
          opacity,
          transform: [{ translateY: combinedY }],
        }]}>
        <View style={[toastSt.iconWrap, { backgroundColor: `${m.iconColor}22` }]}>
          <Ionicons name={m.icon as any} size={22} color={m.iconColor} />
        </View>
        <Text style={[toastSt.msg, { color: toastText }]} numberOfLines={3}>{config.message}</Text>
      </Animated.View>
    </View>
  );
}
const toastSt = StyleSheet.create({
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'flex-start', zIndex:9999, paddingTop:52 },
  box:     { marginHorizontal:16, borderRadius:18, borderWidth:2, paddingVertical:13, paddingHorizontal:14,
    flexDirection:'row', alignItems:'center', gap:10, maxWidth:400,
    shadowColor:'#000', shadowOffset:{width:0,height:10}, shadowOpacity:0.3, shadowRadius:24, elevation:18 },
  iconWrap:{ width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center' },
  msg:     { flex:1, fontSize:13, fontWeight:'700', lineHeight:19 },
});

// ─── Modal shared styles ───────────────────────────────────────────────────────
const mds = StyleSheet.create({
  overlay:        { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  box:            { width:'100%', borderRadius:22, padding:24, alignItems:'center', gap:12,
    borderWidth:1.5,
    shadowColor:'#000', shadowOffset:{width:0,height:20}, shadowOpacity:0.35, shadowRadius:40, elevation:24 },
  iconWrap:       { width:58, height:58, borderRadius:18, alignItems:'center', justifyContent:'center', marginBottom:2, borderWidth:1 },
  title:          { fontSize:17, fontWeight:'700', textAlign:'center', letterSpacing:-0.2 },
  desc:           { fontSize:13.5, fontWeight:'400', textAlign:'center', lineHeight:22 },
  btnRow:         { flexDirection:'row', gap:10, marginTop:4, width:'100%' },
  flex1:          { flex:1 },
  btnCancel:      { height:46, borderRadius:13, borderWidth:1, alignItems:'center', justifyContent:'center' },
  btnCancelText:  { fontSize:14, fontWeight:'600' },
  btnConfirm:     { height:46, borderRadius:13, backgroundColor:'#1A2818', alignItems:'center', justifyContent:'center', flex:1 },
  btnConfirmGreen:{ height:46, borderRadius:13, backgroundColor:'#2D8C52', alignItems:'center', justifyContent:'center', flex:1, marginTop:4, flexDirection:'row', gap:6 },
  btnConfirmText: { fontSize:14, fontWeight:'600', color:'#fff' },
});

// ─── DarkToggle ───────────────────────────────────────────────────────────────
function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const W=52; const H=28; const THUMB=22; const PAD=3; const BORDER=1.5;
  // Inner content area = H - BORDER*2, W - BORDER*2
  // top/left absolute dihitung dari dalam border di RN
  const thumbTop   = (H - BORDER * 2 - THUMB) / 2;       // (25-22)/2 = 1.5
  const thumbLeft  = PAD;                                  // 3 — static start position
  const thumbTravel = W - BORDER * 2 - THUMB - PAD * 2;   // 49-22-6 = 21 — total slide distance

  const anim    = useRef(new Animated.Value(dark ? 1 : 0)).current;
  const prevRef = useRef(dark);
  // Render-time fire — tidak tunggu useEffect (zero frame delay)
  if (prevRef.current !== dark) {
    prevRef.current = dark;
    anim.stopAnimation();
    Animated.spring(anim, { toValue: dark ? 1 : 0, useNativeDriver: false, tension:160, friction:18 }).start();
  }
  const bg              = anim.interpolate({ inputRange:[0,1], outputRange:['#D1D5DB','#1A1A1A'] });
  const borderColor     = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.30)';
  const thumbTranslateX = anim.interpolate({ inputRange:[0,1], outputRange:[0, thumbTravel] });
  return (
    <ScaleBtn onPress={onToggle}>
      <Animated.View style={{
        backgroundColor:bg, width:W, height:H, borderRadius:H/2, position:'relative',
        borderWidth:BORDER, borderColor,
      }}>
        {/*
          Static wrapper dengan elevation — TIDAK bergerak → shadow tidak recalculate per frame.
          Thumb bergerak via translateX di Animated.View di dalam, tanpa elevation.
        */}
        <View style={{
          position:'absolute', left: thumbLeft, top: thumbTop,
          width:THUMB, height:THUMB, borderRadius:THUMB/2,
          shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:4,
        }}>
          <Animated.View style={{
            width:THUMB, height:THUMB, borderRadius:THUMB/2, backgroundColor:'#fff',
            alignItems:'center', justifyContent:'center',
            transform: [{ translateX: thumbTranslateX }],
          }}>
            <Ionicons name={dark ? 'moon' : 'sunny'} size={12} color={dark ? '#555555' : '#F59E0B'} />
          </Animated.View>
        </View>
      </Animated.View>
    </ScaleBtn>
  );
}

// ─── AnimatedCheckmark — BRI mobile banking style ─────────────────────────────
function AnimatedCheckmark({ color, bg, borderColor, size = 68 }: {
  color: string; bg: string; borderColor: string; size?: number;
}) {
  const circleScale  = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkScale   = useRef(new Animated.Value(0.3)).current;
  const rippleScale  = useRef(new Animated.Value(0.7)).current;
  const rippleOpacity= useRef(new Animated.Value(0.8)).current;
  const ring2Scale   = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Step 1: Circle pops in with spring (like BRI circle appear)
    Animated.spring(circleScale, {
      toValue: 1, tension: 220, friction: 7, useNativeDriver: true,
    }).start();

    // Step 2: Checkmark draws in after circle settles (180ms delay)
    // Timer di-cleanup saat component unmount → no memory leak / New Arch warning
    const checkTimer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(checkScale,   { toValue: 1, tension: 280, friction: 6, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    }, 180);

    // Ripple 1: expand outward and fade (BRI pulse ring)
    Animated.sequence([
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(rippleScale,   { toValue: 2.0, duration: 550, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0,   duration: 550, useNativeDriver: true }),
      ]),
    ]).start();

    // Ripple 2: slightly delayed second ring
    Animated.sequence([
      Animated.delay(160),
      Animated.parallel([
        Animated.timing(ring2Scale,   { toValue: 1.7, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ring2Opacity, { toValue: 0,   duration: 480, useNativeDriver: true }),
      ]),
    ]).start();

    return () => clearTimeout(checkTimer);
  }, []);

  const R = size / 2;
  const ICON = Math.round(size * 0.48);

  return (
    <View style={{ width: size + 36, height: size + 36, alignItems: 'center', justifyContent: 'center' }}>
      {/* Ripple ring 1 */}
      <Animated.View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: R,
        borderWidth: 2.5, borderColor,
        transform: [{ scale: rippleScale }],
        opacity: rippleOpacity,
      }} />
      {/* Ripple ring 2 */}
      <Animated.View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: R,
        borderWidth: 1.5, borderColor,
        transform: [{ scale: ring2Scale }],
        opacity: ring2Opacity,
      }} />
      {/* Main circle */}
      <Animated.View style={{
        width: size, height: size, borderRadius: R,
        backgroundColor: bg,
        borderWidth: 2.5, borderColor,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: circleScale }],
        shadowColor: color,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
      }}>
        {/* Checkmark icon — plain checkmark, circle sudah digambar component */}
        <Animated.View style={{ opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark" size={ICON} color={color} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── PhotoThumb ───────────────────────────────────────────────────────────────
// React.memo: tiap PhotoThumb hanya re-render jika props-nya sendiri berubah.
// Tanpa memo, setiap photos.push/splice menyebabkan SEMUA thumb re-render → shimmer restart.
const PhotoThumb = React.memo(function PhotoThumb({ uri, index, onRemove, onPress, C }: {
  uri:string; index:number; onRemove:()=>void; onPress:()=>void; C:typeof LIGHT;
}) {
  const [loaded, setLoaded] = useState(false);
  const fadeImg   = useRef(new Animated.Value(0)).current;
  const shimmerX  = useRef(new Animated.Value(-100)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);
  const SIZE = 104;
  useEffect(() => {
    shimmerLoop.current = Animated.loop(Animated.timing(shimmerX, { toValue:200, duration:1000, easing:Easing.linear, useNativeDriver:true }));
    shimmerLoop.current.start();
    return () => shimmerLoop.current?.stop();
  }, []);
  const onLoaded = () => {
    shimmerLoop.current?.stop();
    setLoaded(true);
    Animated.timing(fadeImg, { toValue:1, duration:280, easing:Easing.out(Easing.ease), useNativeDriver:true }).start();
  };
  const onPressIn = useCallback(() => {
    pressAnim.stopAnimation();
    Animated.timing(pressAnim, { toValue: 0.93, duration: 55, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }).start();
  }, []);
  const onPressOut = useCallback(() => {
    pressAnim.stopAnimation();
    Animated.spring(pressAnim, { toValue: 1, tension: 200, friction: 30, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={{ position:'relative', width:SIZE, height:SIZE, marginRight:10 }}>
      <Animated.View style={{ borderRadius:16, overflow:'hidden', width:SIZE, height:SIZE, transform:[{scale: pressAnim}] }}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        android_ripple={null}
        style={{ borderRadius:16, overflow:'hidden', width:SIZE, height:SIZE }}>
        <View style={{ position:'absolute', top:0, left:0, width:SIZE, height:SIZE, borderRadius:16,
          backgroundColor:C.shimmerBase, overflow:'hidden' }}>
          {!loaded && <Animated.View style={{ position:'absolute', top:0, bottom:0, width:80,
            backgroundColor:C.shimmerHigh, transform:[{translateX:shimmerX}] }} />}
          {!loaded && <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator size="small" color={C.accent} /></View>}
        </View>
        <Animated.Image source={{ uri }} style={{ position:'absolute', top:0, left:0, width:SIZE, height:SIZE,
          borderRadius:16, opacity:fadeImg }} resizeMode="cover" onLoad={onLoaded} />
        {loaded && <View style={{ position:'absolute', bottom:0, left:0, right:0, height:36,
          borderBottomLeftRadius:16, borderBottomRightRadius:16,
          backgroundColor:'rgba(0,0,0,0.45)', alignItems:'center', justifyContent:'center' }}>
          <Ionicons name="expand-outline" size={15} color="rgba(255,255,255,0.9)" /></View>}
      </Pressable>
      </Animated.View>
      <View style={{ position:'absolute', top:7, left:7, backgroundColor:'rgba(0,0,0,0.6)',
        borderRadius:8, paddingHorizontal:6, paddingVertical:2 }}>
        <Text allowFontScaling={false} style={{ color:'#fff', fontSize:10, fontWeight:'800' }}>{index+1}</Text>
      </View>
      <ScaleBtn onPress={onRemove}
        hitSlop={{ top:6, bottom:6, left:6, right:6 }}
        style={{ position:'absolute', top:2, right:2, width:36, height:36, zIndex:20,
          alignItems:'center', justifyContent:'center',
          shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.35, shadowRadius:4, elevation:6 }}
        innerStyle={{ width:32, height:32, backgroundColor:'rgba(220,38,38,0.92)', borderRadius:16,
          alignItems:'center', justifyContent:'center',
          borderWidth:2, borderColor:'rgba(255,255,255,0.5)' }}>
        <Ionicons name="close" size={17} color="#fff" />
      </ScaleBtn>
    </View>
  );
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ text, C }: { text:string; C:typeof LIGHT }) {
  return <Text style={{
    fontSize:10, fontWeight:'600', color:C.textMuted,
    letterSpacing:1.2, textTransform:'uppercase', marginBottom:4,
  }}>{text}</Text>;
}
function PillBadge({ icon, label, color, bg, borderColor, solidIcon }: {
  icon:string; label:string; color:string; bg:string; borderColor:string; solidIcon?:boolean;
}) {
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', gap:5,
      paddingHorizontal:10, paddingVertical:5,
      borderRadius:20, backgroundColor:bg, borderWidth:1, borderColor,
    }}>
      {solidIcon ? (
        <View style={{
          width:15, height:15, borderRadius:4,
          backgroundColor: color,
          alignItems:'center', justifyContent:'center',
        }}>
          <Ionicons name="checkmark-sharp" size={11} color="#fff" />
        </View>
      ) : (
        <Ionicons name={icon as any} size={12} color={color} />
      )}
      <Text allowFontScaling={false} style={{ fontSize:11.5, fontWeight:'600', color, letterSpacing:0.1 }}>{label}</Text>
    </View>
  );
}
function Card({ children, C, style }: { children:React.ReactNode; C:typeof LIGHT; style?:any }) {
  return (
    <View style={[{
      backgroundColor: C.surface, borderRadius: 18, borderWidth: 1,
      borderColor: C.border, padding: 14, gap: 10,
      shadowColor: C.cardShadow, shadowOffset: {width:0, height:2},
      shadowOpacity: 1, shadowRadius: 12, elevation: 3,
    }, style]}>{children}</View>
  );
}
function CardHeader({ icon, title, subtitle, right, C }: {
  icon:string; title?:string; subtitle?:string; right?:React.ReactNode; C:typeof LIGHT;
}) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:11, flex:1 }}>
        <View style={{
          width:36, height:36, borderRadius:12,
          backgroundColor: C.accentLight,
          alignItems:'center', justifyContent:'center',
          borderWidth:1, borderColor:C.borderStrong,
        }}>
          <Ionicons name={icon as any} size={18} color={C.accent} />
        </View>
        <View style={{ flex:1 }}>
          {title !== undefined && (
            <Text allowFontScaling={false} style={{ fontSize:14, fontWeight:'700', color:C.text, letterSpacing:-0.1 }}>{title}</Text>
          )}
          {subtitle && <Text allowFontScaling={false} style={{ fontSize:11.5, color:C.textMuted, marginTop:2, fontWeight:'400' }}>{subtitle}</Text>}
        </View>
      </View>
      {right}
    </View>
  );
}

// ─── Icon Button (minimal) ────────────────────────────────────────────────────
function IconBtn({ icon, onPress, loading=false, color, bg, border, size=36, iconSize=17, borderWidth=1 }: {
  icon:string; onPress:()=>void; loading?:boolean; color:string; bg:string; border:string;
  size?:number; iconSize?:number; borderWidth?:number;
}) {
  return (
    <ScaleBtn onPress={onPress} disabled={loading}
      hitSlop={{ top:8, bottom:8, left:8, right:8 }}
      innerStyle={{ width:size, height:size, borderRadius:size*0.3, backgroundColor:bg,
        borderWidth:borderWidth, borderColor:border, alignItems:'center', justifyContent:'center' }}>
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <Ionicons name={icon as any} size={iconSize} color={color} />
      }
    </ScaleBtn>
  );
}

// ─── NoBpk Toggle (custom segmented pill) ────────────────────────────────────
function BpkModeToggle({ value, onChange, C, dark }: {
  value: boolean; onChange: (v: boolean) => void; C: typeof LIGHT; dark: boolean;
}) {
  // value=true → Auto (left active), value=false → Manual (right active)
  const PILL_H = 36;
  const PILL_W = 152;
  const BORDER = 1.5;
  const PAD    = 3;   // inner padding between border and thumb
  const THUMB_H = PILL_H - BORDER * 2 - PAD * 2;   // exactly fills inner height
  const HALF_W  = (PILL_W - BORDER * 2 - PAD * 2) / 2;

  const anim = useRef(new Animated.Value(value ? 0 : 1)).current;
  // Press-scale untuk feedback langsung saat tap (sebelum animasi thumb selesai)
  const pillScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 0 : 1,
      useNativeDriver: true,
      tension: 200, friction: 30,  // 2*√200 ≈ 28.3 → fast & critically-damped
    }).start();
  }, [value]);

  const onPressIn = useCallback(() => {
    pillScale.stopAnimation();
    Animated.timing(pillScale, { toValue: 0.95, duration: 55, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }).start();
  }, []);
  const onPressOut = useCallback(() => {
    pillScale.stopAnimation();
    Animated.spring(pillScale, { toValue: 1, tension: 200, friction: 30, useNativeDriver: true }).start();
  }, []);

  // thumb slides from left-segment to right-segment
  const thumbTranslate = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, HALF_W],
  });

  return (
    <Animated.View style={{ transform: [{ scale: pillScale }] }}>
    <Pressable
      onPress={() => onChange(!value)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      android_ripple={null}
      style={{
        width: PILL_W,
        height: PILL_H,
        borderRadius: PILL_H / 2,
        borderWidth: BORDER,
        borderColor: C.borderStrong,
        backgroundColor: C.surfaceAlt,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        padding: PAD,
      }}>

      {/* animated sliding thumb — sits inside padding box */}
      <Animated.View style={{
        position: 'absolute',
        left: PAD,
        top: PAD,
        width: HALF_W,
        height: THUMB_H,
        borderRadius: THUMB_H / 2,
        backgroundColor: C.accent,
        transform: [{ translateX: thumbTranslate }],
        shadowColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 4,
      }} />

      {/* Label Auto — left half */}
      <View style={{
        width: HALF_W, height: THUMB_H,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}>
        <Text style={{
          fontSize: 12, fontWeight: '800', letterSpacing: 0.3,
          color: value ? C.accentContrast : C.textSub,
        }} allowFontScaling={false}>Auto</Text>
      </View>

      {/* Label Manual — right half */}
      <View style={{
        width: HALF_W, height: THUMB_H,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}>
        <Text style={{
          fontSize: 12, fontWeight: '800', letterSpacing: 0.3,
          color: !value ? C.accentContrast : C.textSub,
        }} allowFontScaling={false}>Manual</Text>
      </View>
    </Pressable>
    </Animated.View>
  );
} // useTabAnimation
const TAB_KEYS = ['home', 'history', 'settings'] as const;
type TabKey = typeof TAB_KEYS[number];

function useTabAnimation(initial: TabKey) {
  const anims = useRef(
    Object.fromEntries(TAB_KEYS.map(t => [t, {
      opacity:    new Animated.Value(t === initial ? 1 : 0),
      translateY: new Animated.Value(0),
    }])) as Record<TabKey, { opacity: Animated.Value; translateY: Animated.Value }>
  ).current;
  const prev = useRef<TabKey>(initial);

  const transition = useCallback((next: TabKey) => {
    if (next === prev.current) return;
    const old = prev.current;
    prev.current = next;

    // Fade-out departing tab — cepat & tegas
    Animated.parallel([
      Animated.timing(anims[old].opacity, {
        toValue: 0, duration: 80,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(anims[old].translateY, {
        toValue: -6, duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => { anims[old].translateY.setValue(7); });

    // Fade-in arriving tab — delay dipotong 70ms → 10ms (virtually instant overlap)
    anims[next].opacity.setValue(0);
    anims[next].translateY.setValue(7);
    Animated.parallel([
      Animated.timing(anims[next].opacity, {
        toValue: 1, duration: 160, delay: 10,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(10),
        Animated.spring(anims[next].translateY, {
          toValue: 0,
          tension: 240, friction: 32, // 2*√240 ≈ 30.98 → fast critically-damped settle
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return { anims, transition };
}

// ─── AnimatedModal ────────────────────────────────────────────────────────────
// ARSITEKTUR: absolute View (BUKAN RN Modal) — bypass 100% native Android
// window entering animation (slide-dari-bawah) yang tidak bisa di-disable
// via animationType="none".
//
// Tri-layer:
//   • backdropAnim  → backdrop opacity (native driver)
//   • panelOpacity  → panel opacity    (native driver)
//   • panelTranslY  → translateY sheet (native driver)
//   • swipeY        → drag sheet       (native driver)
//
// Touch blocking: backdrop selalu pointerEvents="auto" saat mounted —
// semua tap di luar panel di-consume oleh backdrop, tidak tembus ke bawah.
// onBackdropPress opsional: jika tidak di-pass, tap luar = no-op (blocked).
//
// BackHandler: daftar manual karena tidak ada RN Modal onRequestClose.
//
// Unmount: timer fallback — tidak pernah gantung walau animasi diinterupsi.
type ModalAnimStyle = 'dialog' | 'sheet' | 'fade' | 'zoom';

function AnimatedModal({
  visible, onRequestClose,
  // Props berikut dipertahankan untuk API compatibility tapi tidak dipakai
  // (tidak ada RN Modal lagi)
  statusBarTranslucent: _st = true,
  hardwareAccelerated:  _ha = true,
  animStyle = 'dialog',
  backdropColor = 'rgba(0,0,0,0.55)',
  onBackdropPress,
  swipeToClose = false,
  children,
}: {
  visible: boolean;
  onRequestClose?: () => void;
  statusBarTranslucent?: boolean;
  hardwareAccelerated?: boolean;
  animStyle?: ModalAnimStyle;
  backdropColor?: string;
  onBackdropPress?: () => void;
  swipeToClose?: boolean;
  children: React.ReactNode;
}) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslY = useRef(new Animated.Value(animStyle === 'sheet' ? 60 : 0)).current;
  const swipeY       = useRef(new Animated.Value(0)).current;

  const [mounted, setMounted] = useState(false);
  const mountedRef            = useRef(false);
  const unmountTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag: swipe-to-close sudah menjalankan animasinya sendiri —
  // cegah useEffect visible=false menjalankan exit animation duplikat
  const isClosingBySwipe      = useRef(false);

  const stopAll = useCallback(() => {
    backdropAnim.stopAnimation();
    panelOpacity.stopAnimation();
    panelTranslY.stopAnimation();
  }, []);

  const scheduleUnmount = useCallback((delayMs: number) => {
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    unmountTimerRef.current = setTimeout(() => {
      mountedRef.current = false;
      setMounted(false);
      swipeY.setValue(0);
    }, delayMs);
  }, []);

  // ── BackHandler — Android hardware back button ────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose?.();
      return true; // consume — jangan bubble ke app di bawah
    });
    return () => sub.remove();
  }, [mounted, onRequestClose]);

  // ── Swipe-to-close (sheet only) ───────────────────────────────────────────
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      swipeToClose && animStyle === 'sheet' &&
      g.dy > 12 && g.dy > Math.abs(g.dx) * 1.5,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => { swipeY.stopAnimation(); },
    onPanResponderMove: (_, g) => {
      swipeY.setValue(g.dy >= 0 ? g.dy : g.dy * 0.15);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 90 || (g.vy > 0.5 && g.dy > 20)) {
        isClosingBySwipe.current = true;
        Animated.parallel([
          Animated.timing(swipeY,       { toValue: 700, duration: 220, easing: Easing.in(Easing.poly(3)), useNativeDriver: true }),
          Animated.timing(backdropAnim, { toValue: 0,   duration: 200, easing: Easing.out(Easing.ease),   useNativeDriver: true }),
          Animated.timing(panelOpacity, { toValue: 0,   duration: 200, easing: Easing.out(Easing.ease),   useNativeDriver: true }),
        ]).start(() => {
          swipeY.setValue(0);
          scheduleUnmount(0);
          onRequestClose?.();
        });
      } else {
        Animated.spring(swipeY, { toValue: 0, tension: 200, friction: 22, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeY, { toValue: 0, tension: 200, friction: 22, useNativeDriver: true }).start();
    },
    onShouldBlockNativeResponder: () => false,
  })).current;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      if (unmountTimerRef.current) { clearTimeout(unmountTimerRef.current); unmountTimerRef.current = null; }
      stopAll();
      backdropAnim.setValue(0);
      panelOpacity.setValue(0);
      panelTranslY.setValue(animStyle === 'sheet' ? 60 : 0);
      swipeY.setValue(0);
      mountedRef.current = true;
      setMounted(true);

      // 1 rAF: tunggu React commit layout sebelum animasi mulai
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        Animated.timing(backdropAnim, { toValue: 1, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
        if (animStyle === 'sheet') {
          Animated.timing(panelOpacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
          // tension:300 → faster settle, 2*√300 ≈ 34.6 → friction:36 = critically damped
          Animated.spring(panelTranslY, { toValue: 0, tension: 300, friction: 36, useNativeDriver: true }).start();
        } else {
          // dialog / zoom / fade — pure fade, zero transform, zero gedek
          Animated.timing(panelOpacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
        }
      });

    } else {
      if (!mountedRef.current) return;
      if (isClosingBySwipe.current) {
        isClosingBySwipe.current = false;
        return;
      }
      stopAll();
      const EXIT_MS = 120;  // dismiss terasa cepat & bersih
      const exitAnims: Animated.CompositeAnimation[] = [
        Animated.timing(backdropAnim, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(panelOpacity, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ];
      if (animStyle === 'sheet') {
        exitAnims.push(Animated.timing(panelTranslY, { toValue: 60, duration: EXIT_MS, easing: Easing.in(Easing.ease), useNativeDriver: true }));
      }
      Animated.parallel(exitAnims).start();
      scheduleUnmount(EXIT_MS + 20);
    }
    return () => { if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current); };
  }, [visible]);

  if (!mounted) return null;

  const panelTransform = animStyle === 'sheet'
    ? [{ translateY: swipeToClose ? Animated.add(panelTranslY, swipeY) : panelTranslY }]
    : [];

  return (
    // absolute View — tidak ada RN Modal, tidak ada native window animation
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]} pointerEvents="box-none">

      {/* Layer 1: Backdrop — selalu blokir semua sentuhan di luar panel.
          pointerEvents="auto" → semua tap di area ini di-consume, tidak tembus.
          onBackdropPress opsional; jika tidak di-pass, tap = no-op (tetap blocked). */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: backdropColor, opacity: backdropAnim }]}
        renderToHardwareTextureAndroid
        collapsable={false}
        pointerEvents="auto"
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onBackdropPress ?? undefined}
        />
      </Animated.View>

      {/* Layer 2: Panel */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: panelOpacity, ...(panelTransform.length > 0 && { transform: panelTransform }) },
        ]}
        renderToHardwareTextureAndroid
        collapsable={false}
        pointerEvents="box-none"
        {...(swipeToClose && animStyle === 'sheet' ? panResponder.panHandlers : {})}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ─── ImagePreviewModal — Full-screen photo viewer (simple) ───────────────────
//
// LAYER STACK:
//   [1] Backdrop    — Reanimated View, opacity driven by entry animation
//   [2] Image       — Reanimated View, entry scale + fade
//   [3] Close btn   — di luar <Modal>, selalu visible selama showCloseBtn=true
function ImagePreviewModal({
  uri, onClose, dark,
}: {
  uri: string | null; onClose: () => void; dark: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isDismissing = useRef(false);

  // ── Reanimated shared values ──────────────────────────────────────────────
  const backdropOpacity = useSharedValue(0);
  const entryScale      = useSharedValue(0.92);
  const entryOpacity    = useSharedValue(0);

  const SPRING = { mass: 1, damping: 32, stiffness: 380 }; // fast + critically-damped (2*√380≈38.9)

  // ── Reset state saat uri baru ─────────────────────────────────────────────
  useEffect(() => {
    if (!uri) return;
    isDismissing.current  = false;
    backdropOpacity.value = 0;
    entryScale.value      = 0.92;
    entryOpacity.value    = 0;
    setVisible(true);
  }, [uri]);

  // ── Entry animation ───────────────────────────────────────────────────────
  const handleShow = useCallback(() => {
    if (isDismissing.current) return;
    backdropOpacity.value = withTiming(1, { duration: 160 });
    entryScale.value      = withSpring(1, SPRING);
    entryOpacity.value    = withTiming(1, { duration: 130 });
  }, []);

  // ── Dismiss ───────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current  = true;
    backdropOpacity.value = withTiming(0, { duration: 160 });
    entryOpacity.value    = withTiming(0, { duration: 140 });
    entryScale.value      = withTiming(0.92, { duration: 160 }, (done) => {
      if (done) runOnJS(finalizeDismiss)();
    });
  }, []);

  const finalizeDismiss = useCallback(() => {
    setVisible(false);
    onClose();
  }, [onClose]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const imageContainerStyle = useAnimatedStyle(() => ({
    opacity:   entryOpacity.value,
    transform: [{ scale: entryScale.value }],
  }));

  const closeButtonStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
  }));

  return (
    <>
      {/* ── Modal: backdrop + image + close button ── */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={dismiss}
        statusBarTranslucent
        hardwareAccelerated
        onShow={handleShow}
      >
        {/* [1] Backdrop */}
        <Reanimated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }, backdropStyle]}
          pointerEvents="none"
        />
        {/* [2] Image */}
        <Reanimated.View style={[StyleSheet.absoluteFillObject, imageContainerStyle]}>
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            {uri && (
              <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>
        </Reanimated.View>

        {/* [3] Close button — opacity ikut entryOpacity, tidak pernah flash */}
        <Reanimated.View
          style={[{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 56 : 36,
            right: 18,
          }, closeButtonStyle]}
          pointerEvents="box-none"
        >
          <ScaleBtn
            onPress={dismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            innerStyle={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: 'rgba(0,0,0,0.65)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2.5, borderColor: '#E53935',
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </ScaleBtn>
        </Reanimated.View>
      </Modal>
    </>
  );
}

function FadeCard({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 300, delay,
        easing: Easing.bezier(0.0, 0, 0.2, 1), // Material Decelerate — enter
        useNativeDriver: true,
      }),
      // timing + same Material Decelerate curve → satu "rasa" dengan opacity
      Animated.timing(translateY, {
        toValue: 0, duration: 300, delay,
        easing: Easing.bezier(0.0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <Animated.View collapsable={false} style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// FlatListFadeItem — wrapper animasi entry untuk item di dalam FlatList.
//
// PROBLEM dengan implementasi naif (start dari 0 setiap mount):
//   FlatList recycling menyebabkan item lama unmount + remount → animasi entry
//   berjalan ulang untuk item yang sudah pernah tampil → flash / jitter visual.
//
// SOLUSI: gunakan ref + flag di luar component (WeakMap tidak bisa, tapi ref per-instance cukup).
//   hasAnimated.current di-set true SEBELUM Animated.Value dibuat, sehingga
//   nilai awal Animated.Value sudah 1/0 (sudah di posisi akhir) untuk recycled item.
//   Trik: pada mount pertama hasAnimated.current = false → Value mulai dari 0 → animate.
//         Pada mount berikutnya (recycle) hasAnimated.current tidak reset → Value mulai dari 1 → skip animate.
//
// NOTE: hasAnimated.current di sini di-inisialisasi false setiap mount karena useRef.
//   Ini berarti SETIAP item selalu animate sekali saat pertama kali masuk ke viewport.
//   Untuk item yang benar-benar di-recycle (unmount → remount dengan data berbeda),
//   animasi juga akan berjalan sekali — ini perilaku yang lebih jujur daripada skip total.
//   FlatList dengan windowSize=5 dan maxToRenderPerBatch=8 meminimalkan recycle.
function FlatListFadeItem({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  // Selalu mulai dari 0 — animate entry setiap mount pertama item ini
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 260, delay,
        easing: Easing.bezier(0.0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 260, delay,
        easing: Easing.bezier(0.0, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
    // Cleanup: hentikan animasi jika item unmount sebelum selesai (scroll cepat)
    return () => {
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  // delay stabil (Math.min(index*40,240)) — tidak perlu masuk deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View collapsable={false} style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── AnimatedTabItem — tab bar item with scale+fade on active ─────────────────
function AnimatedTabItem({ active, icon, iconOff, label, onPress, C, s }: {
  active: boolean; icon: string; iconOff: string; label: string;
  onPress: () => void; C: typeof LIGHT; s: any;
}) {
  const scale   = useRef(new Animated.Value(active ? 1 : 0.88)).current;
  const opacity = useRef(new Animated.Value(active ? 1 : 0.52)).current;
  const dot     = useRef(new Animated.Value(active ? 1 : 0)).current;
  // pressScale: immediate tactile feedback on every tap (terpisah dari active-state anim)
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.stopAnimation();
    opacity.stopAnimation();
    dot.stopAnimation();
    Animated.parallel([
      // tension:240, 2*√240 ≈ 30.98 → friction:32 critically-damped & fast
      Animated.spring(scale,   { toValue: active ? 1 : 0.88, tension: 240, friction: 32, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: active ? 1 : 0.52, duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      Animated.spring(dot,     { toValue: active ? 1 : 0,    tension: 240, friction: 32, useNativeDriver: true }),
    ]).start();
  }, [active]);

  const onPressIn = useCallback(() => {
    pressScale.stopAnimation();
    Animated.timing(pressScale, { toValue: 0.88, duration: 55, easing: Easing.bezier(0.4,0,0.2,1), useNativeDriver: true }).start();
  }, []);
  const onPressOut = useCallback(() => {
    pressScale.stopAnimation();
    Animated.spring(pressScale, { toValue: 1, tension: 240, friction: 32, useNativeDriver: true }).start();
  }, []);

  return (
    <Pressable
      style={s.tabItem}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      android_ripple={null}
    >
      <Animated.View style={{ alignItems: 'center', gap: 3, transform: [{ scale: Animated.multiply(scale, pressScale) }], opacity }}>
        <Ionicons name={(active ? icon : iconOff) as any} size={26} color={active ? C.accent : C.textMuted} />
        <Text allowFontScaling={false} style={active ? s.tabLabelActive : s.tabLabel}>{label}</Text>
        <Animated.View style={{
          width: 5, height: 5, borderRadius: 2.5,
          backgroundColor: C.accent,
          transform: [{ scale: dot }], opacity: dot,
        }} />
      </Animated.View>
    </Pressable>
  );
}

// ─── UploadProgressModal — smooth icon/label transition, zero frame drops ────
//
// Arsitektur transisi:
//   1. uploadPhase (prop) berubah → deteksi di useEffect
//   2. Fade-OUT icon + label (opacity 0, scale turun ke 0.72) — 130ms
//   3. BARU update displayPhase (state lokal) → icon/label baru dimuat saat invisible
//   4. doneAnim color transition mulai bersamaan (while invisible)
//   5. Fade-IN icon + label (spring bounce scale 0.72→1, opacity 0→1) — natural
//
// Hasilnya: icon TIDAK pernah terlihat melompat karena swap terjadi saat opacity=0.
// iconColor static dari displayPhase — aman karena warna hanya berubah saat invisible.
// % counter via setNativeProps — zero JS re-render per frame.

function UploadProgressModal({ C, uploadPhase, uploadProgressAnim, photoCount }: {
  C: typeof LIGHT;
  uploadPhase: 'build' | 'upload' | 'done';
  uploadProgressAnim: Animated.Value;
  photoCount: number;
}) {
  // displayPhase: yang BENAR-BENAR dirender — diupdate setelah fade-out selesai
  const [displayPhase, setDisplayPhase] = useState<'build' | 'upload' | 'done'>(uploadPhase);
  const prevPhaseRef   = useRef(uploadPhase);
  const transitionRef  = useRef(false); // guard: cegah overlap transisi

  // doneAnim: 0 = accent, 1 = success — interpolate bg/border/bar color
  const doneAnim = useRef(new Animated.Value(uploadPhase === 'done' ? 1 : 0)).current;

  // Icon animation values
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const iconScale   = useRef(new Animated.Value(1)).current;

  // Label animation values (separate dari icon agar bisa stagger sedikit)
  const labelOpacity    = useRef(new Animated.Value(1)).current;
  const labelTranslateY = useRef(new Animated.Value(0)).current;

  // % counter — pakai state biasa, throttle 60fps
  // setNativeProps TIDAK bekerja di New Architecture (Fabric)
  const [displayPercent, setDisplayPercent] = useState(0);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    // Baca initial value via addListener (satu tembak) — tidak pakai _value (private API,
    // tidak dijamin di New Architecture / Fabric / JSI).
    // addListener langsung fire dengan nilai saat ini → setDisplayPercent terisi sebelum frame pertama.
    const idInit = uploadProgressAnim.addListener(({ value }) => {
      setDisplayPercent(Math.round(value));
    });
    uploadProgressAnim.removeListener(idInit); // bersihkan langsung — cukup 1 panggil untuk init

    const id = uploadProgressAnim.addListener(({ value }) => {
      const now = Date.now();
      if (now - lastFrameRef.current < 16) return;
      lastFrameRef.current = now;
      setDisplayPercent(Math.round(value));
    });
    return () => uploadProgressAnim.removeListener(id);
  }, [uploadProgressAnim]);

  useEffect(() => {
    if (prevPhaseRef.current === uploadPhase) return;
    if (transitionRef.current) return; // guard overlap
    prevPhaseRef.current  = uploadPhase;
    transitionRef.current = true;

    const isDone = uploadPhase === 'done';

    // ── STEP 1: Fade-out icon + label ─────────────────────────────────────────
    // Stop semua animasi sebelumnya agar tidak konflik
    iconOpacity.stopAnimation();
    iconScale.stopAnimation();
    labelOpacity.stopAnimation();
    labelTranslateY.stopAnimation();

    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 0, duration: 110,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 0.78, duration: 110,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 0, duration: 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(labelTranslateY, {
        toValue: -6, duration: 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ── STEP 2: Swap konten (saat invisible — zero flash) ─────────────────
      setDisplayPhase(uploadPhase);

      // ── STEP 3: Color transition mulai sekarang (masih invisible) ─────────
      doneAnim.stopAnimation();
      Animated.timing(doneAnim, {
        toValue: isDone ? 1 : 0,
        duration: 300, useNativeDriver: false,
        easing: Easing.bezier(0.0, 0, 0.2, 1), // Material Decelerate — smooth
      }).start();

      // Reset label + icon entry position
      iconScale.setValue(0.82);
      labelTranslateY.setValue(8);

      // ── STEP 4: Fade-in — spring critically damped, no overshoot ──────────
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1, duration: 200,
          easing: Easing.bezier(0.0, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 260, friction: 22, // critically damped — no wobble
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1, duration: 220, delay: 40,
          easing: Easing.bezier(0.0, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.spring(labelTranslateY, {
          toValue: 0, delay: 40,
          tension: 180, friction: 20,
          useNativeDriver: true,
        }),
      ]).start(() => {
        transitionRef.current = false; // unlock untuk transisi berikutnya
      });
    });
  }, [uploadPhase]);

  const phaseConfig = {
    build:  { icon: 'document-text-outline' as const, label: `Menyiapkan PDF · ${photoCount} foto` },
    upload: { icon: 'cloud-upload-outline'  as const, label: 'Mengupload ke Google Drive...'        },
    done:   { icon: 'checkmark-outline'     as const, label: 'Upload Berhasil!'                     },
  };
  // cfg dari displayPhase — hanya berubah saat icon invisible → no visible jump
  const cfg = phaseConfig[displayPhase];

  // Warna dari displayPhase (static, bukan animated) — aman karena hanya berubah saat invisible
  const staticIconColor = displayPhase === 'done' ? C.success : C.accent;

  // Warna bg/border/bar — interpolated dari doneAnim (smooth, no native driver)
  const iconBg     = doneAnim.interpolate({ inputRange:[0,1], outputRange:[C.accentLight,  C.successBg]     });
  const iconBorder = doneAnim.interpolate({ inputRange:[0,1], outputRange:[C.borderStrong, C.successBorder] });
  const barColor   = doneAnim.interpolate({ inputRange:[0,1], outputRange:[C.accent,       C.success]       });

  return (
    <View style={{
      width: '100%', backgroundColor: C.surface, borderRadius: 24, padding: 24,
      alignItems: 'center', gap: 20,
      borderWidth: 1.5, borderColor: C.border,
      shadowColor: '#000', shadowOffset: { width:0, height:16 }, shadowOpacity: 0.35, shadowRadius: 32, elevation: 20,
    }}>

      {/* ── Icon container — bg/border smooth via doneAnim (non-native) ── */}
      {/* ── Icon itself — opacity + scale via native driver ── */}
      <Animated.View
        style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: iconBg,
          borderWidth: 1.5, borderColor: iconBorder,
          alignItems: 'center', justifyContent: 'center',
        }}
        renderToHardwareTextureAndroid
        collapsable={false}
      >
        {/* size fixed 30 — tidak berubah antar phase, cegah React remount node → zero kedip */}
        <Animated.View
          collapsable={false}
          renderToHardwareTextureAndroid
          style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}
        >
          <Ionicons name={cfg.icon} size={30} color={staticIconColor} />
        </Animated.View>
      </Animated.View>

      {/* ── Label — fade + slide saat phase berubah ── */}
      <Animated.Text
        allowFontScaling={false}
        style={{
          fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'center',
          opacity: labelOpacity,
          transform: [{ translateY: labelTranslateY }],
        }}
      >
        {cfg.label}
      </Animated.Text>

      {/* ── Progress bar + % counter ── */}
      <View style={{ width: '100%', gap: 10 }}>
        {/* Track */}
        <View style={{
          width: '100%', height: 8, borderRadius: 4,
          backgroundColor: C.border, overflow: 'hidden',
        }}>
          <Animated.View style={{
            height: 8, borderRadius: 4,
            width: uploadProgressAnim.interpolate({
              inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp',
            }),
            backgroundColor: barColor,
          }} />
        </View>

        {/* % — state + throttle 60fps, works on New Architecture */}
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 22, fontWeight: '900', letterSpacing: -0.5,
            color: displayPhase === 'done' ? C.success : C.accent,
            textAlign: 'center',
          }}
        >
          {displayPercent}%
        </Text>
      </View>

      <Text allowFontScaling={false} style={{ fontSize: 11, color: C.textMuted, fontWeight: '500' }}>
        Jangan tutup aplikasi selama proses berlangsung
      </Text>
    </View>
  );
}

// ─── ClockDisplay — isolated memo component, prevents 1Hz re-render of entire App ─
const ClockDisplay = React.memo(function ClockDisplay({ s, C }: { s: any; C: typeof LIGHT }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // formatDate / formatTime — uses module-level utilities (stable, no re-creation)
  return (
    <View style={s.clockChip}>
      <Text style={s.clockText}>{formatTime(now)}</Text>
      <Text style={s.dateText}>{formatDate(now)}</Text>
    </View>
  );
});

// ─── Stable redirect URI — computed once at module level (Platform.OS is constant) ──
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'com.bpkscanner',
  ...(Platform.OS !== 'android' && { path: 'oauth2redirect' }),
});

// ─── Date/time utils — module-level so they're stable references (no re-creation) ──
function formatDate(d: Date) {
  const days   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTime(d: Date) {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2,'0')).join(':');
}
function formatDateShort(iso: string) {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}


export default function App() {
  const [dark, setDark]         = useState(false);
  const [tab, setTab]           = useState<'home'|'history'|'settings'>('home');
  const [toast, setToast]       = useState<ToastConfig|null>(null);
  const toastKey = useRef(0);
  const { anims: tabAnims, transition: transitionTab } = useTabAnimation('home');
  const handleTabChange = useCallback((t: TabKey) => {
    transitionTab(t);
    setTab(t);
  }, [transitionTab]);

  const [toastId, setToastId]   = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false); // unmount setelah animasi keluar selesai
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const menuIconAnim = useRef(new Animated.Value(0)).current; // 0=dots, 1=close

  useEffect(() => {
    if (menuOpen) {
      setMenuVisible(true);
      // Guard: cegah overlap jika dibuka ulang saat animasi tutup belum selesai
      dropdownAnim.stopAnimation();
      menuIconAnim.stopAnimation();
      Animated.parallel([
        // tension:300 → fast open, 2*√300 ≈ 34.6 → friction:36 critically damped
        Animated.spring(dropdownAnim, {
          toValue: 1,
          tension: 300, friction: 36,
          useNativeDriver: true,
        }),
        Animated.spring(menuIconAnim, {
          toValue: 1, tension: 300, friction: 36, useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Guard: cegah overlap jika ditutup saat animasi buka belum selesai
      dropdownAnim.stopAnimation();
      menuIconAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(dropdownAnim, {
          toValue: 0, duration: 90,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuIconAnim, {
          toValue: 0, duration: 90,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMenuVisible(false);
      });
    }
  }, [menuOpen]);

  const [privacyModal, setPrivacyModal] = useState(false);
  const [aboutModal, setAboutModal]     = useState(false);
  const [newMonthModal, setNewMonthModal] = useState(false);

  // unit
  const [unitUsaha, setUnitUsaha]   = useState('');
  const [unitInput, setUnitInput]   = useState('');
  const [unitSaved, setUnitSaved]   = useState(false);
  const [unitModal, setUnitModal]   = useState<'ubah'|'simpan'|null>(null);

  // bpk
  const [noBpkUrut, setNoBpkUrut]       = useState('');
  const [isAutoNoBpk, setIsAutoNoBpk]   = useState(true);
  const [noBpkManual, setNoBpkManual]   = useState('');
  // bpkModeAnim: 1 = Auto, 0 = Manual — crossfade tanpa LayoutAnimation
  const bpkModeAnim = useRef(new Animated.Value(1)).current;

  // photos
  const [photos, setPhotos]             = useState<string[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<string|null>(null);
  const [photoLoadingSource, setPhotoLoadingSource] = useState<'camera'|'gallery'|null>(null);
  const [scannerOpen, setScannerOpen]   = useState(false);
  const [cameraModeModal, setCameraModeModal] = useState(false);

  // state untuk konfirmasi duplikat No. BPK sebelum upload
  const [duplikatModal, setDuplikatModal] = useState<{
    noBpk:            string;  // No. BPK yang bentrok
    driveId:          string;  // file lama di Drive yang akan di-overwrite
    histId:           string;  // id record history lama (untuk update), bisa '' jika tidak ada di history lokal
    uploadedAt:       string;  // modifiedTime dari Drive API
  } | null>(null);
  const [checkingDuplikat, setCheckingDuplikat] = useState(false); // spinner saat query Drive
  // bridgeGrey: menutup gap 1-frame antara checkingDuplikat→false dan modal muncul.
  // Harus STATE (bukan ref) agar React re-render tombol saat nilainya berubah.
  const [bridgeGrey, setBridgeGrey] = useState(false);
  const [scanMode, setScanMode]         = useState<'single'|'batch'>('single');

  // folder
  const [folderId, setFolderId]             = useState('');
  const [folderInput, setFolderInput]       = useState('');
  const [folderSaved, setFolderSaved]       = useState(false);
  const [folderSavedMonth, setFolderSavedMonth] = useState('');

  // auth
  const [accessToken, setAccessToken]   = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [userEmail, setUserEmail]       = useState('');
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [authLoading, setAuthLoading]   = useState(false);
  const [reloading, setReloading]       = useState(false);

  // upload
  const [uploading, setUploading]       = useState(false);
  const uploadProgressAnim = useRef(new Animated.Value(0)).current;  // untuk bar width animasi
  const [uploadPhase, setUploadPhase]       = useState<'build'|'upload'|'done'>('build');

  // delete photo confirm
  const [deletePhotoIdx, setDeletePhotoIdx] = useState<number|null>(null);

  // history
  const [history, setHistory]       = useState<UploadRecord[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const C = dark ? DARK : LIGHT;
  // Cache current date — avoid repeated new Date() in JSX, especially in modal
  // Display values — memoized (nowMonth/nowYear untuk teks modal, stabil dalam satu sesi)
  const nowDate  = useMemo(() => new Date(), []);
  const nowMonth = INDO_MONTHS[nowDate.getMonth()];
  const nowYear  = nowDate.getFullYear();
  // Gunakan fresh date untuk comparison (bukan nowDate yang frozen) ─ biar akurat
  // walau app dibuka lama melewati pergantian bulan
  const getNowMonthKey = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}`;
  }, []);

  const showToast = useCallback((message: string, type: ToastConfig['type'] = 'info', duration = 2200) => {
    toastKey.current += 1; setToastId(toastKey.current);
    setToast({ message, type, duration });
  }, []);

  // Android native OAuth: hanya butuh scheme tanpa path
  // iOS / Web: pakai scheme juga (sudah terdaftar di app.json)
  // redirectUri dideklarasi di module level — stable, tidak perlu recreate tiap render
  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: CLIENT_ID,
    redirectUri,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,           // PKCE: aman untuk mobile, tidak butuh client_secret
    accessType: 'offline',
    prompt: AuthSession.Prompt.Consent,
  }, discovery);

  useEffect(() => {
    loadSaved();
  }, []);

  useEffect(() => {
    if (!response) return;
    // Always reset loading — covers success, error, cancel, dismiss
    if (response.type === 'success') {
      exchangeCode(response.params.code);
      // authLoading stays true until exchangeCode finishes (has its own finally)
    } else {
      // error | cancel | dismiss → stop spinner immediately
      setAuthLoading(false);
      if (response.type === 'error') showToast('Login Google gagal. Pastikan koneksi internet aktif dan coba hubungkan ulang akun.', 'error', 4500);
    }
  }, [response]);

  const loadSaved = async () => {
    try {
      const [unit, folder, folderMonth, access, refresh, darkPref, hist, email] = await Promise.all([
        AsyncStorage.getItem(KEY_UNIT), AsyncStorage.getItem(KEY_FOLDER),
        AsyncStorage.getItem(KEY_FOLDER_MONTH),
        AsyncStorage.getItem(KEY_ACCESS), AsyncStorage.getItem(KEY_REFRESH),
        AsyncStorage.getItem(KEY_DARK),  AsyncStorage.getItem(KEY_HISTORY),
        AsyncStorage.getItem(KEY_EMAIL),
      ]);
      if (unit)       { setUnitUsaha(unit); setUnitInput(unit); setUnitSaved(true); }
      if (folder)     { setFolderId(folder); setFolderInput(folder); setFolderSaved(true); }
      if (folderMonth) setFolderSavedMonth(folderMonth);
      if (access)     setAccessToken(access);
      if (refresh)    { setRefreshToken(refresh); setIsLoggedIn(true); }
      if (darkPref)   setDark(darkPref === 'true');
      if (hist)       setHistory(JSON.parse(hist));
      if (email)      setUserEmail(email);
    } catch {}

    // ── Cek pergantian bulan ──
    await checkNewMonth();
  };

  // Cek apakah bulan berubah sejak terakhir buka app
  const checkNewMonth = async () => {
    try {
      const now        = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastSeen   = await AsyncStorage.getItem(KEY_LAST_MONTH);

      // Tampilkan modal jika: pertama kali buka (null) ATAU bulan sudah berganti
      if (lastSeen !== currentKey) {
        await AsyncStorage.setItem(KEY_LAST_MONTH, currentKey);
        // Delay sedikit biar UI sudah render sempurna
        setTimeout(() => setNewMonthModal(true), 800);
      }
    } catch {}
  };

  const saveHistoryRecord = useCallback(async (record: UploadRecord, overwriteId?: string) => {
    // State updater harus pure — AsyncStorage dipanggil di luar, setelah state update selesai
    let updated: UploadRecord[];
    setHistory(prev => {
      updated = overwriteId
        ? prev.map(r => r.id === overwriteId ? { ...record, id: overwriteId } : r)
        : [record, ...prev].slice(0, 100);
      return updated;
    });
    // Persist ke storage di luar updater (Concurrent Mode safe)
    // Gunakan functional read lewat callback ref agar nilai selalu segar
    requestAnimationFrame(async () => {
      setHistory(current => {
        AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(current));
        return current;
      });
    });
  }, []);

  const deleteHistoryRecord = useCallback(async (id: string) => {
    // LayoutAnimation.configureNext HARUS dipanggil SEBELUM setState,
    // bukan di dalam callback setState — callback setState harus pure function
    LayoutAnimation.configureNext(LA_SPRING);
    setHistory(prev => prev.filter(r => r.id !== id));
    // Persist setelah state update selesai (Concurrent Mode safe — updater pure)
    requestAnimationFrame(() => {
      setHistory(current => {
        AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(current));
        return current;
      });
    });
    showToast('Riwayat dihapus', 'info', 1600);
  }, [showToast]);

  const clearAllHistory = useCallback(async () => {
    LayoutAnimation.configureNext(LA_SPRING);
    setHistory([]);
    await AsyncStorage.removeItem(KEY_HISTORY);
    showToast('Semua riwayat dihapus', 'info');
  }, [showToast]);

  // Hapus hanya item yang sedang tampil (hasil pencarian aktif)
  const clearFilteredHistory = useCallback((filtered: UploadRecord[]) => {
    const ids = new Set(filtered.map(r => r.id));
    LayoutAnimation.configureNext(LA_SPRING);
    setHistory(prev => prev.filter(r => !ids.has(r.id)));
    // Persist setelah state update selesai (Concurrent Mode safe — updater pure)
    requestAnimationFrame(() => {
      setHistory(current => {
        AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(current));
        return current;
      });
    });
    showToast(`${filtered.length} riwayat dihapus`, 'info');
  }, [showToast]);

  const toggleDark = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      // AsyncStorage di luar updater — updater harus pure (tidak ada side-effect)
      AsyncStorage.setItem(KEY_DARK, String(next));
      return next;
    });
  }, []);

  const exchangeCode = async (code: string) => {
    setAuthLoading(true);
    try {
      const res  = await fetch('https://oauth2.googleapis.com/token', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          code,
          client_id:     CLIENT_ID,           // ← pakai CLIENT_ID sesuai platform
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
          code_verifier: request?.codeVerifier ?? '', // ← PKCE verifier, wajib disertakan
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await AsyncStorage.setItem(KEY_ACCESS, data.access_token); setAccessToken(data.access_token);
        if (data.refresh_token) { await AsyncStorage.setItem(KEY_REFRESH, data.refresh_token); setRefreshToken(data.refresh_token); }
        // fetch user email
        try {
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          const profile = await profileRes.json();
          if (profile.email) { setUserEmail(profile.email); await AsyncStorage.setItem(KEY_EMAIL, profile.email); }
        } catch {}
        setIsLoggedIn(true); showToast('Akun Google berhasil terhubung!', 'success');
      } else showToast('Login Google gagal: ' + (data.error_description || data.error || 'Tidak diketahui') + '. Periksa koneksi internet dan coba lagi.', 'error', 5000);
    } catch (e: any) { showToast('Terjadi kesalahan saat upload: ' + e.message + '. Pastikan koneksi internet aktif dan coba lagi.', 'error', 5000); }
    finally { setAuthLoading(false); }
  };

  const refreshAccessToken = useCallback(async (): Promise<string|null> => {
    if (!refreshToken) return null;
    try {
      const res  = await fetch('https://oauth2.googleapis.com/token', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ refresh_token:refreshToken, client_id:CLIENT_ID, grant_type:'refresh_token' }).toString(),
      });
      const data = await res.json();
      if (data.access_token) { await AsyncStorage.setItem(KEY_ACCESS, data.access_token); setAccessToken(data.access_token); return data.access_token; }
    } catch {}
    return null;
  }, [refreshToken]);

  const reloadToken = useCallback(async () => {
    setReloading(true);
    try {
      const t = await refreshAccessToken();
      showToast(t ? 'Sesi Google Drive berhasil diperbarui!' : 'Gagal memperbarui sesi. Pastikan koneksi internet aktif atau coba hubungkan ulang akun Google.', t ? 'success' : 'error', t ? 2500 : 5000);
    } finally { setReloading(false); }
  }, [refreshAccessToken, showToast]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_EMAIL]);
    setAccessToken(''); setRefreshToken(''); setUserEmail(''); setIsLoggedIn(false);
    showToast('Akun Google Drive berhasil diputuskan. Kamu perlu hubungkan ulang sebelum upload berikutnya.', 'info', 4000);
  }, [showToast]);

  const getValidToken = useCallback(async () => accessToken || await refreshAccessToken(), [accessToken, refreshAccessToken]);

  const getAutoBpk = useCallback(() => {
    const now = new Date();
    return `${(noBpkUrut || '0').padStart(4,'0')}/${unitUsaha || 'UNIT'}/${ROMAN_MONTHS[now.getMonth()]}/${now.getFullYear()}`;
  }, [noBpkUrut, unitUsaha]);

  const getNoBpk = useCallback(() =>
    isAutoNoBpk ? getAutoBpk() : (noBpkManual || '(belum diisi)')
  , [isAutoNoBpk, getAutoBpk, noBpkManual]);

  const saveUnit = useCallback(async () => {
    const val = unitInput.trim().toUpperCase();
    if (!val)           { showToast('Kode Unit tidak boleh kosong. Masukkan 3 huruf kode unit usaha kamu (contoh: DMI).', 'error', 4000); return; }
    if (val.length !== 3) { showToast('Kode Unit harus tepat 3 huruf. Kamu memasukkan ' + val.length + ' huruf (contoh yang benar: DMI, ARK, UJT).', 'error', 4500); return; }
    await AsyncStorage.setItem(KEY_UNIT, val);
    setUnitUsaha(val); setUnitSaved(true); setUnitModal('simpan');
  }, [unitInput, showToast]);

  const saveFolder = useCallback(async () => {
    if (!folderInput.trim()) { showToast('Folder ID tidak boleh kosong', 'error'); return; }
    const cur = new Date();
    const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;
    await AsyncStorage.setItem(KEY_FOLDER, folderInput.trim());
    await AsyncStorage.setItem(KEY_FOLDER_MONTH, monthKey);
    setFolderId(folderInput.trim()); setFolderSaved(true); setFolderSavedMonth(monthKey);
    showToast('Folder Google Drive berhasil disimpan! Semua upload BPK akan dikirim ke folder ini.', 'success', 3500);
  }, [folderInput, showToast]);

  const takePhoto = useCallback(() => {
    ImagePicker.requestCameraPermissionsAsync().catch(() => {});
    // Defer 1 frame: biar pressOut ScaleBtn mulai duluan di native thread
    // sebelum modal entry animation nyusul — cegah 2 animasi native start bersamaan.
    requestAnimationFrame(() => setCameraModeModal(true));
  }, []);

  const handleScanCapture = useCallback((uris: string[]) => {
    setScannerOpen(false);
    LayoutAnimation.configureNext(LA_SPRING);
    setPhotos(p => [...p, ...uris]);
    showToast(`${uris.length} foto ditambahkan`, 'success', 1600);
  }, [showToast]);

  const pickGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showToast('Izin akses galeri diperlukan. Buka Pengaturan > Izin Aplikasi dan aktifkan akses Galeri untuk BPK Scanner.', 'warning', 5000); return; }
    setPhotoLoadingSource('gallery');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: true });
      if (!result.canceled) {
        setPhotos(p => [...p, ...result.assets.map((a: any) => a.uri)]);
        showToast(`${result.assets.length} foto ditambahkan`, 'success', 1600);
      }
    } finally { setPhotoLoadingSource(null); }
  }, [showToast]);

  const readFileAsBase64 = useCallback(async (uri: string): Promise<string> => {
    const safeUri = uri.startsWith('file://') ? uri : 'file://' + uri;
    // expo-file-system/legacy — readAsStringAsync tetap fully supported, tidak deprecated
    return FileSystem.readAsStringAsync(safeUri, { encoding: 'base64' as any });
  }, []);

  const buildPdf = useCallback(async (
    onPhotoProgress?: (done: number, total: number) => void,
    onPdfRenderStart?: () => void,
  ): Promise<{ pdfUri: string; tempUris: string[] }> => {
    const noBpk    = getNoBpk();
    const tempUris: string[] = [];
    const total    = photos.length;

    // Sequential processing — mencegah OOM di Android low-end
    // Progress update per foto sehingga loading bar bergerak nyata
    const imgHtmlParts: string[] = [];
    for (let idx = 0; idx < total; idx++) {
      const uri   = photos[idx];
      const isPng = uri.toLowerCase().endsWith('.png');
      const mime  = isPng ? 'image/png' : 'image/jpeg';

      let readableUri = uri;
      if (uri.startsWith('content://')) {
        const ext  = isPng ? 'png' : 'jpg';
        const dest = `${FileSystem.cacheDirectory ?? ''}bpk_img_${idx}.${ext}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        readableUri = dest;
        tempUris.push(dest);
      }
      if (!readableUri.startsWith('file://')) readableUri = 'file://' + readableUri;

      const b64 = await readFileAsBase64(readableUri);
      imgHtmlParts.push(`<div style="page-break-inside:avoid;margin-bottom:20px;">
        <p style="font-size:11px;color:#888;margin:0 0 6px;">Lampiran ${idx + 1}</p>
        <img src="data:${mime};base64,${b64}" style="width:100%;max-height:680px;object-fit:contain;border-radius:4px;"/>
      </div>`);

      // Update progress setelah setiap foto selesai diproses
      onPhotoProgress?.(idx + 1, total);
      // Yield ke JS thread — mencegah ANR / UI freeze
      await new Promise(r => setTimeout(r, 0));
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:32px;}
.header{border-bottom:2px solid #3D6B4A;padding-bottom:16px;margin-bottom:24px;}
.title{font-size:18px;font-weight:bold;color:#3D6B4A;}.company{font-size:12px;color:#3D6B4A;margin-top:2px;font-weight:600;}
.subtitle{font-size:12px;color:#6B7280;margin-top:4px;}.row{display:flex;gap:32px;margin-bottom:20px;}
.field .lbl{font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;}
.field .val{font-size:14px;font-weight:600;color:#111;margin-top:2px;}
.section-title{font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;border-top:1px solid #E5E7EB;padding-top:20px;}
</style></head><body>
<div class="header"><div class="title">Bukti Pengeluaran Kas</div>
<div class="company">PT Capella Dinamik Nusantara</div>
<div class="subtitle">Dicetak: ${formatDate(new Date())} pukul ${formatTime(new Date())}</div></div>
<div class="row">
<div class="field"><div class="lbl">Nomor BPK</div><div class="val">${noBpk}</div></div>
<div class="field"><div class="lbl">Unit Usaha</div><div class="val">${unitUsaha || '-'}</div></div>
</div>
<div class="section-title">Lampiran Foto (${total})</div>
${imgHtmlParts.join('\n')}</body></html>`;

    // Sinyal ke caller: semua foto sudah di-encode, sekarang masuk fase render PDF
    // (Print.printToFileAsync bisa memakan waktu 2–10 detik tergantung jumlah foto)
    onPdfRenderStart?.();

    const { uri: pdfUri } = await Print.printToFileAsync({ html });
    return { pdfUri, tempUris };
  }, [photos, getNoBpk, unitUsaha, readFileAsBase64]);

  // Smooth animated progress helper — stops any running animation before starting new one.
  // `from` is optional: if provided, hard-resets to that value first (useful on init).
  // If omitted, continues smoothly from wherever the bar currently sits.
  const animateProgress = useCallback((to: number, ms: number, from?: number): Promise<void> => {
    uploadProgressAnim.stopAnimation();
    if (from !== undefined) uploadProgressAnim.setValue(from);
    return new Promise(resolve => {
      Animated.timing(uploadProgressAnim, {
        toValue: to, duration: ms,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start(({ finished }) => {
        // Selalu resolve — baik selesai normal maupun di-interrupt oleh stopAnimation.
        // Ini penting agar await animateProgress() tidak pernah hang/deadlock
        // meski ada animasi lain yang stopAnimation() di tengah jalan.
        resolve();
      });
    });
  }, []);

  // ── Core upload — dipanggil langsung atau setelah konfirmasi overwrite ─────
  // overwriteDriveId : file Drive lama yang di-PATCH (konten diganti, link tetap sama)
  // overwriteHistId  : record history lama yang akan di-replace
  const doUpload = useCallback(async (overwriteDriveId?: string, overwriteHistId?: string) => {

    uploadProgressAnim.setValue(0);
    setUploadPhase('build');
    setUploading(true);
    setBridgeGrey(false); // upload sudah mulai, abu-abu kini dijaga oleh uploading=true

    // ── Tunggu 2 frame agar AnimatedModal upload progress selesai commit ke native thread ──
    // Khusus overwrite flow: modal duplikat baru saja exit, lalu modal upload masuk.
    // 2x RAF memastikan kedua modal tidak overlap di compositor layer.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // ── Bar langsung crawl 0 → 5% — user tidak lihat stuck di 0% ───────────
    Animated.timing(uploadProgressAnim, {
      toValue: 5,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Track all temp files to clean up regardless of success/failure
    let collectedTempUris: string[] = [];
    let pdfUri: string | null = null;

    try {
      const token = await getValidToken();
      if (!token) {
        showToast('Sesi Google Drive kamu sudah berakhir. Buka tab Dokumen → tekan Perbarui Sesi atau Hubungkan ulang akun Google.', 'error', 5500);
        return;
      }

      // Token berhasil → bump ke 8% sebagai sinyal phase dimulai
      await animateProgress(8, 200);

      // Phase 1: Build PDF
      // Foto encoding: 8% → 48% (proporsional per foto)
      // PDF rendering: 48% → 54% crawl lambat (Print.printToFileAsync bisa 2–10 detik)
      const { pdfUri: builtPdfUri, tempUris } = await buildPdf(
        (done, total) => {
          // Setiap foto: dari 8% hingga 48%, proporsional — TANPA setState, zero re-render
          const target = 8 + (done / total) * 40;
          uploadProgressAnim.stopAnimation();
          Animated.timing(uploadProgressAnim, {
            toValue: target,
            duration: 180,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }).start();
        },
        () => {
          // Semua foto selesai di-encode, sekarang Print.printToFileAsync berjalan.
          // Crawl dengan Easing.linear — quad menyebabkan bar hampir tidak bergerak
          // di paruh akhir sehingga kelihatan stuck. Linear = kecepatan konstan, selalu terlihat maju.
          // Range 48→51 (konservatif) — animateProgress(54) di bawah yang snap ke 54%.
          uploadProgressAnim.stopAnimation();
          Animated.timing(uploadProgressAnim, {
            toValue: 51,
            duration: 12000,
            easing: Easing.linear,
            useNativeDriver: false,
          }).start();
        },
      );
      pdfUri = builtPdfUri;
      collectedTempUris = tempUris;

      // PDF render selesai — stop crawl, smooth ke 54%
      await animateProgress(54, 300);

      // Phase 2: Read PDF + switch fase (54% → 62%)
      setUploadPhase('upload');
      const fileName   = getNoBpk() + '.pdf';
      const boundary   = 'bpk_boundary_x';
      const safePdfUri = pdfUri.startsWith('file://') ? pdfUri : 'file://' + pdfUri;
      const [pdfB64]   = await Promise.all([
        readFileAsBase64(safePdfUri),
        animateProgress(62, 500),
      ]);

      // body POST (upload baru) — sertakan parents agar file masuk ke folder tujuan
      const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/pdf' });
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdfB64}\r\n` +
        `--${boundary}--`;

      // bodyPatch (overwrite) — TANPA parents; Drive API melarang parents di PATCH/update.
      // File sudah ada di folder yang benar, cukup update name + konten PDF saja.
      const metadataPatch = JSON.stringify({ name: fileName, mimeType: 'application/pdf' });
      const bodyPatch =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPatch}\r\n` +
        `--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdfB64}\r\n` +
        `--${boundary}--`;

      // ── helper animasi network start (fire-and-forget) ──────────────────────
      const startNetworkAnim = () => {
        uploadProgressAnim.stopAnimation();
        Animated.timing(uploadProgressAnim, {
          toValue: 88, duration: 4500,
          easing: Easing.out(Easing.quad), useNativeDriver: false,
        }).start();
      };

      // ── helper sprint ke 92% setelah fetch selesai ────────────────────────
      const sprintTo92 = () => {
        uploadProgressAnim.stopAnimation();
        return new Promise<void>(resolve => {
          Animated.timing(uploadProgressAnim, {
            toValue: 92, duration: 250,
            easing: Easing.out(Easing.ease), useNativeDriver: false,
          }).start(() => resolve());
        });
      };

      const handleSuccess = async (driveFileId: string) => {
        setUploadPhase('done');
        await animateProgress(100, 380);
        // Beri jeda lebih panjang: user sempat lihat "100% + checkmark" sebelum modal tutup
        // dan animasi modal exit tidak bentrok dengan animasi progress bar selesai
        await new Promise(r => setTimeout(r, 520));
        setUploading(false);
        // Delay toast sedikit agar tidak muncul bersamaan dengan modal closing animation
        setTimeout(() => {
          const label = overwriteDriveId ? 'Berhasil diperbarui!' : 'Upload berhasil!';
          showToast(`${label} ${fileName}`, 'success', 4000);
        }, 160);
        await saveHistoryRecord({
          id:         Date.now().toString(),
          fileName,
          noBpk:      getNoBpk(),
          unit:       unitUsaha,
          photoCount: photos.length,
          uploadedAt: new Date().toISOString(),
          driveId:    driveFileId,
        }, overwriteHistId);
        LayoutAnimation.configureNext(LA_SPRING);
        setPhotos([]); setNoBpkUrut(''); setNoBpkManual('');
      };

      // ── Cabang PATCH (overwrite) vs POST (upload baru) — diputuskan DI SINI,
      //    sebelum network call apapun, agar tidak pernah double-upload.
      if (overwriteDriveId) {
        // ── OVERWRITE MODE ────────────────────────────────────────────────────
        // PATCH /upload/drive/v3/files/{fileId} — update konten, file ID tetap sama.
        // bodyPatch TIDAK mengandung `parents` (Drive API tolak parents di PATCH).
        startNetworkAnim();
        const resPatch = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${overwriteDriveId}?uploadType=multipart`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body: bodyPatch,
          }
        );
        await sprintTo92();
        const resPatchJson = await resPatch.json();
        if (resPatch.ok && resPatchJson.id) {
          await handleSuccess(resPatchJson.id);
        } else if (resPatchJson.error?.code === 401) {
          // Token expired edge-case → refresh & retry PATCH (bukan POST)
          const freshToken = await refreshAccessToken();
          if (!freshToken) { setUploading(false); showToast('Sesi Google Drive kadaluarsa. Buka tab Dokumen dan hubungkan ulang akun Google.', 'error', 5500); return; }
          await animateProgress(60, 200);
          startNetworkAnim();
          const res2 = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${overwriteDriveId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body: bodyPatch,
          });
          await sprintTo92();
          const res2Json = await res2.json();
          if (res2.ok && res2Json.id) await handleSuccess(res2Json.id);
          else { setUploading(false); showToast('Gagal memperbarui file: ' + (res2Json.error?.message || 'Coba lagi.'), 'error', 5000); }
        } else {
          setUploading(false);
          showToast('Gagal memperbarui file: ' + (resPatchJson.error?.message || 'Periksa koneksi internet dan coba lagi.'), 'error', 5000);
        }
      } else {
        // ── UPLOAD BARU (POST) ────────────────────────────────────────────────
        startNetworkAnim();
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
        await sprintTo92();
        const result = await res.json();
        if (res.ok && result.id) {
          await handleSuccess(result.id);
        } else if (result.error?.code === 401) {
          // Token expired edge-case → refresh & retry POST
          const freshToken = await refreshAccessToken();
          if (!freshToken) {
            setUploading(false);
            showToast('Sesi Google Drive kadaluarsa. Buka tab Dokumen dan hubungkan ulang akun Google.', 'error', 5500);
            return;
          }
          await animateProgress(60, 200);
          startNetworkAnim();
          const res2 = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
          });
          await sprintTo92();
          const result2 = await res2.json();
          if (res2.ok && result2.id) await handleSuccess(result2.id);
          else { setUploading(false); showToast('Upload gagal setelah refresh sesi: ' + (result2.error?.message || 'Periksa koneksi internet dan coba lagi.'), 'error', 5000); }
        } else {
          setUploading(false);
          showToast('Upload gagal: ' + (result.error?.message || 'Terjadi kesalahan. Periksa koneksi internet dan coba upload lagi.'), 'error', 5000);
        }
      }
    } catch (e: any) {
      setUploading(false);
      showToast('Terjadi kesalahan saat upload: ' + e.message + '. Pastikan koneksi internet aktif dan coba lagi.', 'error', 5000);
    } finally {
      // Always clean up temp files — prevent cache bloat
      const toDelete = [...collectedTempUris, ...(pdfUri ? [pdfUri.startsWith('file://') ? pdfUri : 'file://' + pdfUri] : [])];
      await Promise.allSettled(toDelete.map(u => FileSystem.deleteAsync(u, { idempotent: true })));
    }
  }, [photos, folderId, isLoggedIn, unitUsaha, getValidToken, buildPdf, getNoBpk,
      readFileAsBase64, animateProgress, showToast, saveHistoryRecord, refreshAccessToken]);

  // ── Entry point upload — cek duplikat ke Google Drive API ──────────────────
  // Sumber kebenaran = Drive langsung; deteksi akurat meski history lokal kosong.
  const uploadToDrive = useCallback(async () => {
    // Guard: cegah double-trigger (double-tap, rapid re-render, dsb.)
    // Jika salah satu fase sedang berjalan → abaikan tap berikutnya.
    if (checkingDuplikat || uploading || bridgeGrey) return;

    if (!photos.length)  { showToast('Belum ada foto lampiran. Tambahkan minimal 1 foto sebelum upload ke Google Drive.', 'warning', 4000); return; }
    if (!folderId)       { showToast('Folder Google Drive belum diatur. Buka tab Pengaturan dan isi ID Folder Drive tujuan terlebih dahulu.', 'warning', 5000); return; }
    if (!isLoggedIn)     { showToast('Akun Google Drive belum terhubung. Buka tab Dokumen dan tekan tombol Hubungkan untuk masuk dengan akun Google.', 'warning', 5000); return; }

    const currentNoBpk = getNoBpk();
    const fileName     = currentNoBpk + '.pdf';

    // ── Cek duplikat ke Drive API ────────────────────────────────────────────
    setCheckingDuplikat(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setCheckingDuplikat(false);
        showToast('Sesi Google Drive kamu sudah berakhir. Buka tab Dokumen → tekan Perbarui Sesi atau Hubungkan ulang akun Google.', 'error', 5500);
        return;
      }

      const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const driveData = driveRes.ok ? await driveRes.json() : null;
      const driveFile = driveData?.files?.[0] ?? null;

      if (driveFile) {
        // Ada duplikat di Drive → set checkingDuplikat+bridgeGrey+modal dalam 1 batch render
        const localRecord = history.find(r => r.driveId === driveFile.id || r.noBpk === currentNoBpk);
        setCheckingDuplikat(false);
        setBridgeGrey(true);
        setDuplikatModal({
          noBpk:      currentNoBpk,
          driveId:    driveFile.id,
          histId:     localRecord?.id ?? '',
          uploadedAt: driveFile.modifiedTime,
        });
      } else {
        // Tidak ada duplikat (atau query gagal) → langsung upload
        // checkingDuplikat + bridgeGrey di-set false/true dalam 1 batch,
        // lalu doUpload via RAF (uploading=true akan menjaga abu-abu)
        setCheckingDuplikat(false);
        setBridgeGrey(true);
        requestAnimationFrame(() => doUpload());
      }
    } catch {
      setCheckingDuplikat(false);
      setBridgeGrey(true);
      requestAnimationFrame(() => doUpload());
    }
  }, [photos, folderId, isLoggedIn, getNoBpk, history, doUpload, showToast, getValidToken,
      checkingDuplikat, uploading, bridgeGrey]);

  // ─── STYLES ───────────────────────────────────────────────────────────────
  // Dua stylesheet pre-built (light & dark) — StyleSheet.create() hanya 2x seumur app.
  // Toggle hanya ganti pointer `s`, bukan rebuild apapun → JS thread tidak block.
  const sLight = useMemo(() => buildStyles(LIGHT), []);
  const sDark  = useMemo(() => buildStyles(DARK),  []);
  const s = dark ? sDark : sLight;

  // ─── UPLOAD READINESS — stable memos, not IIFE every render ─────────────
  const noBpkFilled = useMemo(() =>
    isAutoNoBpk ? noBpkUrut.trim().length > 0 : noBpkManual.trim().length > 0
  , [isAutoNoBpk, noBpkUrut, noBpkManual]);

  const canUpload = useMemo(() =>
    isLoggedIn && unitSaved && noBpkFilled && photos.length > 0
  , [isLoggedIn, unitSaved, noBpkFilled, photos.length]);

  const missingItems = useMemo(() => canUpload ? [] : [
    !isLoggedIn    && 'Login Google',
    !unitSaved     && 'Unit Usaha',
    !noBpkFilled   && 'No. BPK',
    !photos.length && 'Foto',
  ].filter(Boolean) as string[], [canUpload, isLoggedIn, unitSaved, noBpkFilled, photos.length]);

  // ─── SEARCH ───────────────────────────────────────────────────────────────
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBorderAnim = useRef(new Animated.Value(0)).current;
  const onSearchFocus = useCallback(() => {
    setSearchFocused(true);
    Animated.timing(searchBorderAnim, { toValue:1, duration:110, useNativeDriver:false }).start();
  }, []);
  const onSearchBlur = useCallback(() => {
    setSearchFocused(false);
    Animated.timing(searchBorderAnim, { toValue:0, duration:110, useNativeDriver:false }).start();
  }, []);
  const searchBorderColor = searchBorderAnim.interpolate({
    inputRange:[0,1], outputRange:[C.border, C.inputBorder],
  });

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter(r =>
      r.fileName.toLowerCase().includes(q) ||
      r.noBpk.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  // ─── HOME ─────────────────────────────────────────────────────────────────
  // useMemo: JSX hanya di-rebuild ulang saat dependency berubah — bukan setiap
  // App re-render (toast, progress, tab switch dsb. tidak trigger rebuild).
  const homeContent = useMemo(() => (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" overScrollMode="never">

      {/* ── GOOGLE ACCOUNT ── */}
      <FadeCard delay={0}><Card C={C} style={{
        borderColor: isLoggedIn ? C.successBorder : C.danger,
        borderWidth: 1.5,
        backgroundColor: isLoggedIn ? `${C.success}12` : `${C.danger}10`,
      }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
            <View style={{
              width:34, height:34, borderRadius:11,
              backgroundColor: isLoggedIn ? C.successBg : C.dangerBg,
              alignItems:'center', justifyContent:'center',
              borderWidth:1.5,
              borderColor: isLoggedIn ? C.successBorder : C.danger,
            }}>
              <Ionicons name="logo-google" size={17} color={isLoggedIn ? C.success : C.danger} />
            </View>
            <View style={{ flex:1, minWidth:0 }}>
              <Text style={{ fontSize:14, fontWeight:'800', color:C.text, letterSpacing:-0.2 }}>Akun Google Cabang</Text>
              {!isLoggedIn && (
                <Text style={{ fontSize:11, color: C.textMuted, marginTop:1, fontWeight:'600' }} numberOfLines={1}>
                  Belum terhubung
                </Text>
              )}
            </View>
          </View>
          {/* icon buttons row */}
          <View style={{ flexDirection:'row', gap:6, alignItems:'center', marginLeft:8 }}>
            {isLoggedIn ? (
              <>
                {/* Reload */}
                <IconBtn icon="refresh-outline" onPress={reloadToken} loading={reloading}
                  color={C.accent} bg={C.accentLight} border={C.borderStrong}
                  size={44} iconSize={22} borderWidth={1.5} />
                {/* Putuskan */}
                <IconBtn icon="log-out-outline" onPress={logout}
                  color={C.danger} bg={C.dangerBg} border={`${C.danger}40`}
                  size={44} iconSize={22} borderWidth={1.5} />
              </>
            ) : (
              <>
                {/* Reload (coba perbarui token lama jika ada) */}
                <IconBtn icon="refresh-outline" onPress={reloadToken} loading={reloading}
                  color={C.accent} bg={C.accentLight} border={C.borderStrong}
                  size={44} iconSize={22} borderWidth={1.5} />
                {/* Hubungkan */}
                <ScaleBtn
                  onPress={() => {
                    setAuthLoading(true);
                    promptAsync().catch(() => setAuthLoading(false));
                  }}
                  disabled={!request || authLoading}
                  innerStyle={{ height:32, paddingHorizontal:12, borderRadius:10,
                    backgroundColor: `${C.success}22`,
                    borderWidth:1.5, borderColor: C.successBorder,
                    alignItems:'center', justifyContent:'center',
                    flexDirection:'row', gap:5 }}>
                  {authLoading
                    ? <ActivityIndicator color={C.success} size="small" />
                    : <>
                        <Ionicons name="link-outline" size={13} color={C.success} />
                        <Text style={{ color:C.success, fontWeight:'700', fontSize:12 }}>Hubungkan</Text>
                      </>
                  }
                </ScaleBtn>
              </>
            )}
          </View>
        </View>
        {isLoggedIn && (
          <PillBadge
            icon="checkbox-outline"
            solidIcon
            label={`Akun Terhubung${userEmail ? ' : ' + userEmail : ''}`}
            color={C.success} bg={C.successBg} borderColor={C.successBorder}
          />
        )}
      </Card></FadeCard>

      {/* ── UNIT USAHA ── */}
      <FadeCard delay={55}><Card C={C} style={{ borderColor: unitSaved ? C.successBorder : C.danger, borderWidth:1.5,
        backgroundColor: unitSaved ? `${C.success}12` : `${C.danger}10` }}>
        <CardHeader icon="business-outline" title="Kode Unit Usaha" C={C} />
        <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
          {unitSaved ? (
            <View style={s.unitSavedBox}>
              <View style={{
                width:18, height:18, borderRadius:5,
                backgroundColor: C.success,
                alignItems:'center', justifyContent:'center',
              }}>
                <Ionicons name="checkmark-sharp" size={13} color="#fff" />
              </View>
              <Text style={s.unitSavedText}>{unitInput.toUpperCase()}</Text>
            </View>
          ) : (
            <FocusInput C={C} style={{ flex:1 }}
              placeholder="Contoh: DMI"
              placeholderTextColor={C.textMuted}
              value={unitInput}
              onChangeText={(t: string) => setUnitInput(t.replace(/[^a-zA-Z]/g,'').toUpperCase())}
              autoCapitalize="characters"
              maxLength={3}
            />
          )}
          <ScaleBtn onPress={unitSaved ? () => setUnitModal('ubah') : saveUnit} innerStyle={s.btnSave}>
            <Text style={s.btnSaveText}>{unitSaved ? 'Ubah' : 'Simpan'}</Text>
          </ScaleBtn>
        </View>
      </Card></FadeCard>

      {/* ── NOMOR BPK ── */}
      <FadeCard delay={110}><Card C={C} style={{ borderColor: (isAutoNoBpk ? noBpkUrut.trim().length > 0 : noBpkManual.trim().length > 0) ? C.successBorder : C.danger, borderWidth:1.5,
        backgroundColor: (isAutoNoBpk ? noBpkUrut.trim().length > 0 : noBpkManual.trim().length > 0) ? `${C.success}12` : `${C.danger}10` }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', flexWrap:'nowrap' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
            <View style={{ width:34, height:34, borderRadius:11, backgroundColor:C.accentLight,
              alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:C.borderStrong,
              flexShrink:0 }}>
              <Ionicons name="document-text-outline" size={17} color={C.accent} />
            </View>
            <Text style={{ fontSize:14, fontWeight:'800', color:C.text, letterSpacing:-0.2 }} numberOfLines={1}>
              Nomor BPK
            </Text>
          </View>
          <BpkModeToggle
            value={isAutoNoBpk}
            onChange={(v) => {
              // dismiss keyboard dulu — cegah collision dengan layout keyboard
              Keyboard.dismiss();
              setIsAutoNoBpk(v);
              bpkModeAnim.stopAnimation();
              Animated.timing(bpkModeAnim, {
                toValue: v ? 1 : 0,
                duration: 200,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }).start();
            }}
            C={C} dark={dark} />
        </View>

        {/*
          Kedua panel di-render sekaligus dengan posisi absolute di dalam
          container tinggi tetap (46px). Cross-fade via opacity + useNativeDriver:true
          → ZERO LayoutAnimation, zero keyboard collision, zero jank.
        */}
        <View style={{ height: 46 }}>

          {/* ── Auto panel ── */}
          <Animated.View
            pointerEvents={isAutoNoBpk ? 'auto' : 'none'}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              flexDirection: 'row', gap: 8, alignItems: 'center',
              opacity: bpkModeAnim,
            }}>
            <FocusInput C={C} style={{ width: 80 }}
              placeholder="0001" placeholderTextColor={C.textMuted}
              value={noBpkUrut} keyboardType="numeric" maxLength={4}
              onChangeText={(t: string) => setNoBpkUrut(t.replace(/[^0-9]/g,''))}
            />
            <View style={s.previewBox}>
              <Text style={s.previewLabel}>Nama file</Text>
              <Text style={s.previewValue} numberOfLines={1}>{getAutoBpk()}.pdf</Text>
            </View>
          </Animated.View>

          {/* ── Manual panel ── */}
          <Animated.View
            pointerEvents={isAutoNoBpk ? 'none' : 'auto'}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              opacity: bpkModeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            }}>
            <FocusInput C={C}
              placeholder="0001/DMI/V/2026" placeholderTextColor={C.textMuted}
              value={noBpkManual} onChangeText={setNoBpkManual}
            />
          </Animated.View>

        </View>
      </Card></FadeCard>

      {/* ── FOTO LAMPIRAN ── */}
      <FadeCard delay={165}><Card C={C} style={{ gap:0, paddingHorizontal:0, paddingBottom:0, borderColor: photos.length > 0 ? C.successBorder : C.danger, borderWidth:1.5,
        backgroundColor: photos.length > 0 ? `${C.success}12` : `${C.danger}10` }}>
        <View style={{ paddingHorizontal:12, paddingBottom:10 }}>
          <CardHeader icon="images-outline" title="Foto Lampiran BPK"
            subtitle="Ambil Foto atau Pilih Dari Galeri Anda" C={C}
            right={<PillBadge icon="image-outline" label={`${photos.length} foto`}
              color={C.accent} bg={C.accentLight} borderColor={C.borderStrong} />}
          />
        </View>
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:12, paddingBottom:10, flexDirection:'row', alignItems:'center' }}>
            {photos.map((uri, i) => (
              <PhotoThumb key={uri} uri={uri} index={i} C={C}
                onPress={() => setPreviewPhoto(uri)}
                onRemove={() => setDeletePhotoIdx(i)}
              />
            ))}
            <Pressable onPress={takePhoto}
              style={{
                width:104, height:104, borderRadius:16,
                borderWidth:1.5, borderColor:C.borderStrong,
                borderStyle:'dashed', backgroundColor:C.accentLight,
                alignItems:'center', justifyContent:'center', gap:6,
              }}>
              <View style={{ width:32, height:32, borderRadius:16, backgroundColor:C.accentLight, alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="add" size={22} color={C.accent} />
              </View>
              <Text style={{ fontSize:10.5, fontWeight:'600', color:C.accent }}>Tambah Foto</Text>
            </Pressable>
          </ScrollView>
        )}
        <View style={{ flexDirection:'row', gap:8, paddingHorizontal:12, paddingBottom:12,
          paddingTop: photos.length > 0 ? 0 : 4 }}>
          <ScaleBtn onPress={takePhoto}
            style={[{ flex:1 }, photoLoadingSource === 'gallery' && { opacity:0.38 }]}
            innerStyle={s.photoBtn} disabled={!!photoLoadingSource}>
            {photoLoadingSource === 'camera'
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Ionicons name="camera-outline" size={18} color={C.accent} />
            }
            <Text style={s.photoBtnText}>{photoLoadingSource === 'camera' ? 'Proses...' : 'Kamera'}</Text>
          </ScaleBtn>
          <ScaleBtn onPress={pickGallery}
            style={[{ flex:1 }, photoLoadingSource === 'camera' && { opacity:0.38 }]}
            innerStyle={s.photoBtn} disabled={!!photoLoadingSource}>
            {photoLoadingSource === 'gallery'
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Ionicons name="images-outline" size={18} color={C.accent} />
            }
            <Text style={s.photoBtnText}>{photoLoadingSource === 'gallery' ? 'Proses...' : 'Galeri'}</Text>
          </ScaleBtn>
        </View>
      </Card></FadeCard>

      {/* ── UPLOAD ── */}
      <FadeCard delay={220}>
        <View style={{ gap:6 }}>
          {(() => {
            // modalActive: salah satu modal sedang tampil → tombol abu solid
            // bridgeGrey (state) menutup gap 1-frame: checkingDuplikat→false sebelum modal muncul
            const modalActive = uploading || checkingDuplikat || duplikatModal !== null || bridgeGrey;
            const isActive = canUpload && !modalActive;
            const trulyDisabled = !canUpload && !modalActive;
            return (
              <ScaleBtn
                onPress={uploadToDrive}
                disabled={uploading || checkingDuplikat || !canUpload}
                style={isActive ? {
                  borderRadius:16,
                  shadowColor:C.accent, shadowOffset:{width:0,height:4},
                  shadowOpacity:0.28, shadowRadius:12, elevation:4,
                } : undefined}
                innerStyle={[
                  s.btnPrimary,
                  // Abu solid: modal sedang aktif (fokus ke modal, bukan tombol)
                  // Abu yang sama untuk semua state non-aktif — tidak ada peralihan warna
                  (modalActive || trulyDisabled) && {
                    backgroundColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
                    borderWidth:1.5, borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.15)',
                  },
                ]}>
                {checkingDuplikat ? (
                  <ActivityIndicator
                    size="small"
                    color={dark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.40)'}
                  />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={18}
                    color={
                      isActive ? C.accentContrast
                               : (dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)')
                    }
                  />
                )}
                <Text style={[
                  s.btnPrimaryText,
                  (modalActive || trulyDisabled) && { color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)' },
                ]}>
                  {checkingDuplikat ? 'Memeriksa...' : 'Upload ke Google Drive'}
                </Text>
              </ScaleBtn>
            );
          })()}
          {!canUpload && !uploading && !checkingDuplikat && duplikatModal === null && (
            <View style={{
              flexDirection:'row', alignItems:'center', gap:6, justifyContent:'center',
              paddingHorizontal:12, paddingVertical:8, borderRadius:12,
              backgroundColor:C.dangerBg, borderWidth:1, borderColor:`${C.danger}35`,
            }}>
              <Ionicons name="alert-circle-outline" size={13} color={C.danger} />
              <Text style={{ fontSize:12, fontWeight:'500', color:C.danger, textAlign:'center' }}>
                Belum lengkap: {missingItems.join(' , ')}
              </Text>
            </View>
          )}
        </View>
      </FadeCard>

    </ScrollView>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [s, C, dark, isLoggedIn, userEmail, unitUsaha, unitSaved, unitInput, unitModal,
      isAutoNoBpk, noBpkUrut, noBpkManual, photos, previewPhoto, photoLoadingSource,
      cameraModeModal, scanMode, canUpload, noBpkFilled, missingItems,
      uploading, checkingDuplikat, duplikatModal, bridgeGrey, deletePhotoIdx,
      toggleDark, uploadToDrive, setCameraModeModal, setDeletePhotoIdx,
      setNoBpkUrut, setNoBpkManual, setIsAutoNoBpk, setUnitModal]);

  // ─── HISTORY ──────────────────────────────────────────────────────────────
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteHistoryId, setDeleteHistoryId] = useState<string|null>(null);

  const historyContent = useMemo(() => (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      {/* search + clear */}
      <View style={{ paddingHorizontal:16, paddingTop:14, paddingBottom:10, gap:10 }}>
        <Animated.View style={[s.searchWrap, { borderColor:searchBorderColor, borderWidth:2 }]}>
          <Ionicons name="search-outline" size={18} color={searchFocused ? C.accent : C.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Cari Nomor Bukti Pengeluaran Kas..."
            placeholderTextColor={C.textMuted}
            value={historySearch}
            onChangeText={setHistorySearch}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            autoCapitalize="none"
            returnKeyType="search"
            textBreakStrategy="simple"
          />
          {/* Selalu dirender — tidak mount/unmount — hindari delay touch di Android */}
          <Pressable
            onPress={() => setHistorySearch('')}
            hitSlop={{ top:12, bottom:12, left:12, right:12 }}
            android_ripple={{ color:'rgba(128,128,128,0.2)', borderless:true, radius:20 }}
            style={({ pressed }) => ({
              opacity: historySearch.length > 0 ? (pressed ? 0.5 : 1) : 0,
              padding: 4,
            })}
            pointerEvents={historySearch.length > 0 ? 'auto' : 'none'}
          >
            <Ionicons name="close-circle" size={20} color={C.textSub} />
          </Pressable>
        </Animated.View>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ fontSize:12, color:C.textSub, fontWeight:'600' }}>
            {filteredHistory.length} dokumen{historySearch ? ' ditemukan' : ' tersimpan'}
          </Text>
          {historySearch.trim().length > 0 && filteredHistory.length > 0 && (
            <ScaleBtn onPress={() => setClearConfirm(true)}
              innerStyle={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:6,
                borderRadius:10, borderWidth:2, borderColor:`${C.danger}40`, backgroundColor:C.dangerBg }}>
              <Ionicons name="trash-outline" size={13} color={C.danger} />
              <Text style={{ fontSize:12, fontWeight:'700', color:C.danger }}>Hapus Hasil ({filteredHistory.length})</Text>
            </ScaleBtn>
          )}
          {!historySearch.trim() && history.length > 1 && (
            <ScaleBtn onPress={() => setClearConfirm(true)}
              innerStyle={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:6,
                borderRadius:10, borderWidth:2, borderColor:`${C.danger}40`, backgroundColor:C.dangerBg }}>
              <Ionicons name="trash-outline" size={13} color={C.danger} />
              <Text style={{ fontSize:12, fontWeight:'700', color:C.danger }}>Hapus Semua ({history.length})</Text>
            </ScaleBtn>
          )}
        </View>
      </View>

      {filteredHistory.length === 0 ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:14, paddingBottom:60, paddingTop:80 }}>
          <View style={{
            width:80, height:80, borderRadius:28,
            backgroundColor:C.accentLight, alignItems:'center', justifyContent:'center',
            borderWidth:1.5, borderColor:C.borderStrong,
          }}>
            <Ionicons name={historySearch ? 'search-outline' : 'time-outline'} size={36} color={C.accent} />
          </View>
          <View style={{ alignItems:'center', gap:6 }}>
            <Text style={{ fontSize:17, fontWeight:'800', color:C.text, letterSpacing:-0.2 }}>
              {historySearch ? 'Tidak Ditemukan' : 'Belum Ada Riwayat'}
            </Text>
            <Text style={{ fontSize:13, color:C.textSub, textAlign:'center', paddingHorizontal:40, lineHeight:20, fontWeight:'500' }}>
              {historySearch
                ? `Tidak ada dokumen yang cocok\ndengan "${historySearch}"`
                : 'Riwayat upload akan muncul di sini\nsetelah berhasil upload ke Google Drive'}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding:16, gap:10, paddingBottom:36 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={10}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          // getItemLayout: paddingTop 16 + (itemHeight + gap 10) * index
          // Konstanta HISTORY_ITEM_HEIGHT — update di sana kalau layout card berubah
          getItemLayout={(_, index) => ({
            length: HISTORY_ITEM_HEIGHT,
            offset: 16 + (HISTORY_ITEM_HEIGHT + 10) * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <FlatListFadeItem delay={Math.min(index * 40, 240)}>
            <View style={[s.historyCard, {
              borderLeftWidth:3, borderLeftColor:C.success,
              borderTopLeftRadius:4, borderBottomLeftRadius:4,
            }]}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={{
                  width:36, height:36, borderRadius:10,
                  backgroundColor:C.successBg, alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Ionicons name="cloud-done-outline" size={17} color={C.success} />
                </View>
                <View style={{ flex:1, minWidth:0 }}>
                  <Text style={s.histFileName} numberOfLines={1}>{item.noBpk}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap' }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                      <Ionicons name="business-outline" size={10} color={C.accent} />
                      <Text style={{ fontSize:11, fontWeight:'700', color:C.accent }}>{item.unit || '-'}</Text>
                    </View>
                    <Text style={{ fontSize:10, color:C.border }}>•</Text>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                      <Ionicons name="image-outline" size={10} color={C.textMuted} />
                      <Text style={{ fontSize:11, fontWeight:'600', color:C.textSub }}>{item.photoCount} foto</Text>
                    </View>
                    <Text style={{ fontSize:10, color:C.border }}>•</Text>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                      <Ionicons name="time-outline" size={10} color={C.textMuted} />
                      <Text style={{ fontSize:11, fontWeight:'600', color:C.textSub }}>{formatDateShort(item.uploadedAt)}</Text>
                    </View>
                  </View>
                </View>
                <ScaleBtn onPress={() => setDeleteHistoryId(item.id)}
                  hitSlop={{ top:10, bottom:10, left:10, right:10 }}
                  innerStyle={{ width:30, height:30, borderRadius:9, backgroundColor:C.dangerBg,
                    alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:`${C.danger}30` }}>
                  <Ionicons name="trash-outline" size={14} color={C.danger} />
                </ScaleBtn>
              </View>
            </View>
            </FlatListFadeItem>
          )}
        />
      )}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [s, C, dark, history, filteredHistory, historySearch, searchFocused, searchBorderColor,
      onSearchFocus, onSearchBlur, setHistorySearch, clearConfirm, setClearConfirm,
      deleteHistoryId, setDeleteHistoryId, deleteHistoryRecord, clearFilteredHistory]);

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  const settingsContent = useMemo(() => (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" overScrollMode="never">
      <Card C={C}>
        <CardHeader icon="contrast-outline" title="Tampilan"
          subtitle={dark ? 'Mode Gelap aktif' : 'Mode Terang aktif'} C={C}
          right={<DarkToggle dark={dark} onToggle={toggleDark} />} />
      </Card>
      <Card C={C} style={{
        backgroundColor: folderSaved ? C.successBg : C.dangerBg,
        borderColor: folderSaved ? C.successBorder : `${C.danger}55`,
        borderWidth:1.5,
      }}>
        <CardHeader icon="folder-outline" title="Google Drive Folder"
          subtitle="Link Google Drive" C={C}
          right={folderSaved ? (
            <PillBadge icon="checkbox-outline" solidIcon label="Tersimpan"
              color={C.success} bg={C.successBg} borderColor={C.successBorder} />
          ) : undefined} />
        <SectionLabel text="Folder ID" C={C} />
        <View style={{ flexDirection:'row', gap:10 }}>
          <FocusInput C={C} style={{ flex:1 }}
            placeholder="Paste link atau Folder ID Drive"
            placeholderTextColor={C.textMuted}
            value={folderInput}
            onChangeText={(t: string) => {
              // Auto-extract folder ID from Google Drive URL
              // Supports formats:
              // https://drive.google.com/drive/folders/FOLDER_ID
              // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
              // https://drive.google.com/drive/u/0/folders/FOLDER_ID
              const match = t.match(/\/folders\/([a-zA-Z0-9_-]+)/);
              if (match) {
                setFolderInput(match[1]);
              } else {
                setFolderInput(t.trim());
              }
            }}
            autoCapitalize="none"
          />
          <ScaleBtn onPress={saveFolder} innerStyle={s.btnSave}>
            <Text style={s.btnSaveText}>{folderSaved ? 'Update' : 'Simpan'}</Text>
          </ScaleBtn>
        </View>
        {folderSaved && folderId ? (
          <Text style={{ fontSize:12, color:C.textSub }} numberOfLines={1}>ID: {folderId}</Text>
        ) : null}
        {folderSaved && folderSavedMonth && folderSavedMonth !== getNowMonthKey() ? (
            <View style={{ flexDirection:'row', alignItems:'flex-start', gap:8, padding:12,
              borderRadius:12, backgroundColor:C.warningBg, borderWidth:1, borderColor:`${C.warning}40` }}>
              <View style={{ width:24, height:24, borderRadius:7, backgroundColor:`${C.warning}20`,
                borderWidth:1.5, borderColor:`${C.warning}50`,
                alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <Ionicons name="alert-outline" size={13} color={C.warning} />
              </View>
              <Text style={{ flex:1, fontSize:12.5, color:C.warning, lineHeight:18, fontWeight:'600' }}>
                Ganti link Google Drive jika sudah memasuki periode bulan terbaru
              </Text>
            </View>
        ) : null}

        {/* ── Hintbox Panduan Folder Drive ── */}
        <View style={{ borderRadius:14, borderWidth:1.5, borderColor:C.borderStrong,
          backgroundColor:C.accentLight, overflow:'hidden' }}>
          {/* Header hint */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:8,
            paddingHorizontal:14, paddingVertical:10,
            borderBottomWidth:1, borderBottomColor:C.borderStrong,
            backgroundColor:C.accentLight }}>
            <View style={{ width:24, height:24, borderRadius:7, backgroundColor:C.surface,
              borderWidth:1.5, borderColor:C.borderStrong,
              alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Ionicons name="bulb-outline" size={13} color={C.accent} />
            </View>
            <Text style={{ fontSize:12, fontWeight:'800', color:C.accent, letterSpacing:0.2 }}>
              Panduan Penggunaan Folder Drive
            </Text>
          </View>

          {/* Poin-poin */}
          <View style={{ padding:14, gap:10 }}>
            {[
              {
                icon: 'folder-open-outline',
                color: C.accent,
                title: 'Folder berbeda tiap bulan',
                desc:  'Buat folder Google Drive terpisah untuk setiap bulan, misalnya "05. Mei", "06. Juni", dan seterusnya agar dokumen tidak tercampur.',
              },
              {
                icon: 'swap-horizontal-outline',
                color: C.warning,
                title: 'Ganti link di awal bulan baru',
                desc:  'Setiap memasuki bulan baru, segera perbarui link folder di kolom di atas sebelum melakukan upload. Jika lupa, dokumen BPK akan masuk ke folder bulan yang sebelumnya.',
              },
              {
                icon: 'link-outline',
                color: C.success,
                title: 'Cara mendapatkan link folder',
                desc:  'Buka Google Drive → klik kanan folder tujuan → pilih "Bagikan" atau "Salin tautan" → paste langsung ke kolom ini. Aplikasi akan otomatis mendeteksi ID foldernya (Pastikan Akun Google Cabang Sudah Dipilih Sebagai Editor Pada Setiap Folder Google Drive).',
              },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'flex-start', gap:10 }}>
                <View style={{ width:26, height:26, borderRadius:8, backgroundColor:C.surface,
                  borderWidth:1.5, borderColor:`${item.color}40`,
                  alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                  <Ionicons name={item.icon as any} size={13} color={item.color} />
                </View>
                <View style={{ flex:1, gap:2 }}>
                  <Text style={{ fontSize:12, fontWeight:'800', color:C.text }}>{item.title}</Text>
                  <Text style={{ fontSize:11.5, color:C.textSub, lineHeight:17, fontWeight:'500' }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Card>
    </ScrollView>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [s, C, dark, toggleDark, folderId, folderInput, folderSaved, folderSavedMonth,
      setFolderInput, saveFolder]);

  // ─── ABOUT content (reused in modal) ─────────────────────────────────────
  const renderAboutContent = () => (
    <>
      <View style={{ alignItems:'center', paddingVertical:28, gap:12 }}>
        <View style={{ width:88, height:88, borderRadius:22, overflow:'hidden' }}>
          <Image
            source={require('./Logo.jpg')}
            style={{ width:88, height:88 }}
            resizeMode="cover"
          />
        </View>
        <Text style={{ fontSize:22, fontWeight:'900', color:C.text, letterSpacing:-0.5 }}>BPK Scanner</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          <PillBadge icon="code-slash-outline" label="v1.0.0" color={C.accent} bg={C.accentLight} borderColor={C.borderStrong} />
          <PillBadge icon="shield-checkmark-outline" label="Internal" color={C.success} bg={C.successBg} borderColor={C.successBorder} />
        </View>
      </View>
      <Card C={C} style={{ gap:0, paddingHorizontal:0, paddingVertical:0, overflow:'hidden' }}>
        {[
          { icon:'person-outline',           label:'Developer',  value:'Ahmad Ragash Putra' },
          { icon:'phone-portrait-outline',   label:'Platform',   value:'Android & PWA' },
          { icon:'mail-outline',             label:'Kontak',     value:'Ragashhmunthe@gmail.com' },
          { icon:'git-branch-outline',       label:'Versi',      value:'1.0.0' },
          { icon:'shield-checkmark-outline', label:'Jenis',      value:'Khusus Internal' },
        ].map(({ icon, label, value }, idx, arr) => (
          <View key={label}>
            <View style={s.aboutInfoRow}>
              <View style={{ width:36, height:36, borderRadius:11, backgroundColor:C.accentLight,
                alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.borderStrong }}>
                <Ionicons name={icon as any} size={17} color={C.accent} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.aboutInfoLabel}>{label}</Text>
                <Text style={s.aboutInfoValue}>{value}</Text>
              </View>
            </View>
            {idx < arr.length - 1 && <View style={{ height:1, backgroundColor:C.border, marginLeft:68 }} />}
          </View>
        ))}
      </Card>
      <Text style={s.aboutFooter}>© 2026 PT Capella Dinamik Nusantara{'\n'}All Rights Reserved</Text>
    </>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider style={{ flex: 1 }}>
    <SafeAreaView style={s.safe}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
          <View style={{ width:36, height:36, borderRadius:10, overflow:'hidden', marginRight:9 }}>
            <Image
              source={require('./Logo.jpg')}
              style={{ width:36, height:36 }}
              resizeMode="cover"
            />
          </View>
          <View>
            <Text style={s.headerTitle}>BPK Scanner</Text>
            <Text style={s.headerSub}>PT Capella Dinamik Nusantara</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <ClockDisplay s={s} C={C} />
          <ScaleBtn onPress={() => setMenuOpen(v => !v)}
            innerStyle={[s.menuBtn, menuOpen && { backgroundColor:C.accentLight, borderColor:C.borderStrong }]}>
            <Animated.View style={{
              position:'absolute',
              opacity: menuIconAnim.interpolate({ inputRange:[0,1], outputRange:[1,0] }),
              transform: [{ scale: menuIconAnim.interpolate({ inputRange:[0,1], outputRange:[1,0.5] }) }],
            }}>
              <Ionicons name="ellipsis-vertical" size={20} color={C.text} />
            </Animated.View>
            <Animated.View style={{
              opacity: menuIconAnim,
              transform: [{ scale: menuIconAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1] }) }],
            }}>
              <Ionicons name="close" size={20} color={C.accent} />
            </Animated.View>
          </ScaleBtn>
        </View>
      </View>

      {/* ── DROPDOWN ── */}
      {menuVisible && (
        <>
          {/* Backdrop — intercept tap luar, non-animated */}
          <Pressable
            style={{ position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:150 }}
            onPress={() => setMenuOpen(false)}
          />
          {/* Animated dropdown panel */}
          <Animated.View style={[s.dropdown, {
            opacity: dropdownAnim,
            transform: [
              {
                translateY: dropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          }]}>
            <ScaleBtn
              onPress={() => { setMenuOpen(false); setAboutModal(true); }}
              innerStyle={s.dropdownItem}>
              <View style={s.dropdownIconWrap}><Ionicons name="information-circle-outline" size={16} color={C.accent} /></View>
              <Text style={s.dropdownText}>Tentang Aplikasi</Text>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </ScaleBtn>
            <View style={s.dropdownDivider} />
            <ScaleBtn
              onPress={() => { setMenuOpen(false); setPrivacyModal(true); }}
              innerStyle={s.dropdownItem}>
              <View style={s.dropdownIconWrap}><Ionicons name="document-text-outline" size={16} color={C.accent} /></View>
              <Text style={s.dropdownText} numberOfLines={1}>Ketentuan Pengguna</Text>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </ScaleBtn>
          </Animated.View>
        </>
      )}

      {/* ── CONTENT ── */}
      <View style={{ flex:1 }}>
        {(TAB_KEYS).map(t => (
          <Animated.View
            key={t}
            collapsable={false}
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity:   tabAnims[t].opacity,
                transform: [{ translateY: tabAnims[t].translateY }],
              },
            ]}
            pointerEvents={tab === t ? 'auto' : 'none'}
          >
            {t === 'home'     && homeContent}
            {t === 'history'  && historyContent}
            {t === 'settings' && settingsContent}
          </Animated.View>
        ))}
      </View>

      {/* ── BOTTOM TAB BAR ── */}
      <View style={s.tabBar}>
        {([
          { id:'home'     as TabKey, icon:'document-text',    iconOff:'document-text-outline',    label:'Dokumen'    },
          { id:'history'  as TabKey, icon:'time',             iconOff:'time-outline',             label:'Riwayat'    },
          { id:'settings' as TabKey, icon:'settings',         iconOff:'settings-outline',         label:'Pengaturan' },
        ]).map(({ id, icon, iconOff, label }) => (
          <AnimatedTabItem
            key={id}
            active={tab === id}
            icon={icon}
            iconOff={iconOff}
            label={label}
            onPress={() => handleTabChange(id)}
            C={C}
            s={s}
          />
        ))}
      </View>

      {/* ── MODAL: preview foto ── */}
      <ImagePreviewModal
        uri={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        dark={dark}
      />

    </SafeAreaView>

      {/* ── MODAL: unit ubah ── */}
      <AnimatedModal visible={unitModal === 'ubah'} animStyle="dialog" onRequestClose={() => setUnitModal(null)}>
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:C.border }]} onPress={() => {}}>
            <View style={[mds.iconWrap, { backgroundColor:C.accentLight, borderColor:C.borderStrong }]}>
              <Ionicons name="create-outline" size={28} color={C.accent} />
            </View>
            <Text style={[mds.title, { color:C.text }]}>Ubah Kode Unit?</Text>
            <Text style={[mds.desc, { color:C.textSub }]}>
              Kode unit <Text style={{ fontWeight:'800', color:C.text }}>{unitUsaha}</Text> akan diubah.
            </Text>
            <View style={mds.btnRow}>
              <ScaleBtn onPress={() => setUnitModal(null)} style={mds.flex1}
                innerStyle={[mds.btnCancel, { borderColor:C.border, backgroundColor:C.surfaceAlt }]}>
                <Text style={[mds.btnCancelText, { color:C.textSub }]}>Batal</Text>
              </ScaleBtn>
              <ScaleBtn onPress={() => { setUnitModal(null); setUnitSaved(false); }} style={mds.flex1}
                innerStyle={mds.btnConfirm}>
                <Text style={mds.btnConfirmText}>Ya, Ubah</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: unit simpan sukses ── */}
      <AnimatedModal visible={unitModal === 'simpan'} animStyle="dialog" onRequestClose={() => setUnitModal(null)}>
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:C.border }]} onPress={() => {}}>
            <AnimatedCheckmark color={C.success} bg={C.successBg} borderColor={C.successBorder} />
            <Text style={[mds.title, { color:C.text }]}>Berhasil Disimpan!</Text>
            <Text style={[mds.desc, { color:C.textSub }]}>
              Kode unit <Text style={{ fontWeight:'800', color:C.success }}>{unitUsaha}</Text> berhasil disimpan. Kode ini akan digunakan secara otomatis pada nomor BPK kamu.
            </Text>
            <View style={{ width:'100%', marginTop:8 }}>
              <ScaleBtn onPress={() => setUnitModal(null)}
                innerStyle={[mds.btnConfirmGreen, { flex:undefined, width:'100%', backgroundColor:C.success }]}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={mds.btnConfirmText}>Simpan</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: clear history confirm ── */}
      <AnimatedModal visible={clearConfirm} animStyle="dialog" onRequestClose={() => setClearConfirm(false)}>
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:C.border }]} onPress={() => {}}>
            <View style={[mds.iconWrap, { backgroundColor:C.dangerBg, borderColor:`${C.danger}40` }]}>
              <Ionicons name="trash-outline" size={28} color={C.danger} />
            </View>
            <Text style={[mds.title, { color:C.text }]}>
              {historySearch.trim() ? `Hapus ${filteredHistory.length} Hasil Ini?` : 'Hapus Semua Riwayat?'}
            </Text>
            <Text style={[mds.desc, { color:C.textSub }]}>
              {historySearch.trim()
                ? <><Text style={{ fontWeight:'800', color:C.text }}>{filteredHistory.length} catatan</Text> yang cocok dengan kata kunci <Text style={{ fontWeight:'800', color:C.text }}>"{historySearch.trim()}"</Text> akan dihapus permanen. Riwayat lainnya tetap aman.</>
                : <>Seluruh <Text style={{ fontWeight:'800', color:C.text }}>{history.length} catatan</Text> upload akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</>
              }
            </Text>
            <View style={mds.btnRow}>
              <ScaleBtn onPress={() => setClearConfirm(false)} style={mds.flex1}
                innerStyle={[mds.btnCancel, { borderColor:C.border, backgroundColor:C.surfaceAlt }]}>
                <Text style={[mds.btnCancelText, { color:C.textSub }]}>Batal</Text>
              </ScaleBtn>
              <ScaleBtn
                onPress={() => {
                  setClearConfirm(false);
                  clearFilteredHistory(filteredHistory);
                  setHistorySearch('');
                }}
                style={mds.flex1}
                innerStyle={[mds.btnConfirm, { backgroundColor:C.danger }]}>
                <Text style={mds.btnConfirmText}>Hapus</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: konfirmasi hapus 1 riwayat ── */}
      <AnimatedModal visible={deleteHistoryId !== null} animStyle="dialog"
        onRequestClose={() => setDeleteHistoryId(null)} statusBarTranslucent hardwareAccelerated>
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:C.border }]} onPress={() => {}}>
            <View style={[mds.iconWrap, { backgroundColor:C.dangerBg, borderColor:`${C.danger}40` }]}>
              <Ionicons name="document-outline" size={28} color={C.danger} />
            </View>
            <Text style={[mds.title, { color:C.text }]}>Hapus Riwayat Ini?</Text>
            <Text style={[mds.desc, { color:C.textSub }]}>
              {(() => {
                const rec = history.find(r => r.id === deleteHistoryId);
                return rec
                  ? <>Catatan upload <Text style={{ fontWeight:'800', color:C.text }}>{rec.noBpk}</Text> akan dihapus permanen dari riwayat.</>
                  : 'Catatan upload ini akan dihapus permanen dari riwayat.';
              })()}
              {'\n'}Tindakan ini tidak dapat dibatalkan.
            </Text>
            <View style={mds.btnRow}>
              <ScaleBtn onPress={() => setDeleteHistoryId(null)} style={mds.flex1}
                innerStyle={[mds.btnCancel, { borderColor:C.border, backgroundColor:C.surfaceAlt }]}>
                <Text style={[mds.btnCancelText, { color:C.textSub }]}>Batal</Text>
              </ScaleBtn>
              <ScaleBtn
                onPress={() => {
                  if (deleteHistoryId) deleteHistoryRecord(deleteHistoryId);
                  setDeleteHistoryId(null);
                }}
                style={mds.flex1}
                innerStyle={[mds.btnConfirm, { backgroundColor:C.danger }]}>
                <Text style={mds.btnConfirmText}>Hapus</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: Ketentuan Pengguna ── */}
      <AnimatedModal visible={privacyModal} animStyle="sheet" swipeToClose
        onRequestClose={() => setPrivacyModal(false)}
        statusBarTranslucent hardwareAccelerated backdropColor="rgba(0,0,0,0.55)">
        <View style={{ flex:1, justifyContent:'flex-end' }} pointerEvents="box-none">
          <View style={{ backgroundColor:C.surface, borderTopLeftRadius:28, borderTopRightRadius:28,
            paddingTop:20, paddingBottom:40, paddingHorizontal:24,
            shadowColor:'#000', shadowOffset:{width:0,height:-8}, shadowOpacity:0.2, shadowRadius:24, elevation:20 }}>
            {/* handle bar */}
            <View style={{ width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginBottom:20 }} />
            <View style={{ alignItems:'center', gap:12, marginBottom:20 }}>
              <View style={{ width:56, height:56, borderRadius:18, backgroundColor:C.accentLight,
                alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:C.borderStrong }}>
                <Ionicons name="document-text-outline" size={26} color={C.accent} />
              </View>
              <Text style={{ fontSize:18, fontWeight:'900', color:C.text, letterSpacing:-0.3 }}>Ketentuan Pengguna</Text>
              <Text style={{ fontSize:12, color:C.textSub, textAlign:'center' }}>BPK Scanner · PT Capella Dinamik Nusantara</Text>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {/* Ketentuan 1 */}
              {([
                { title:'Pengguna Resmi',
                  body:'Aplikasi ini hanya diperuntukkan bagi karyawan resmi PT Capella Dinamik Nusantara yang mendapatkan akses dari manajemen cabang.' },
                { title:'Penggunaan Aplikasi',
                  body:'BPK Scanner digunakan khusus untuk keperluan pencatatan dan pengarsipan Bukti Pengeluaran Kas (BPK) internal perusahaan. Dilarang digunakan untuk keperluan di luar lingkup pekerjaan.' },
                { title:'Data & Penyimpanan',
                  body:'Foto dan dokumen BPK yang diupload akan tersimpan di Google Drive akun Google cabang yang telah dikonfigurasi. Pengguna bertanggung jawab menjaga kerahasiaan akses akun Google tersebut.' },
                { title:'Keamanan & Privasi',
                  body:'Aplikasi tidak menyimpan data pribadi pengguna di server eksternal. Semua data dokumen hanya tersimpan di Google Drive cabang sesuai konfigurasi dan di memori lokal perangkat sementara.' },
                { title:'Tanggung Jawab Pengguna',
                  body:'Pengguna wajib memastikan nomor BPK, kode unit, dan foto yang diunggah adalah benar dan akurat. Kesalahan data menjadi tanggung jawab pengguna yang bersangkutan.' },
              ] as const).map((item, i) => (
                <View key={i} style={{ marginBottom:12 }}>
                  <Text style={{ fontSize:12.5, color:C.textSub, lineHeight:19 }}>
                    <Text style={{ fontWeight:'800', color:C.text }}>{item.title}{'  '}</Text>
                    {item.body}
                  </Text>
                </View>
              ))}

              <View style={{ backgroundColor:C.surfaceAlt, borderRadius:12, borderWidth:1.5,
                borderColor:C.border, padding:14, marginBottom:4 }}>
                <Text style={{ fontSize:11, color:C.textSub, lineHeight:17, textAlign:'center' }}>
                  Dengan menggunakan BPK Scanner, pengguna dianggap telah membaca dan menyetujui seluruh ketentuan di atas.
                  Pelanggaran terhadap ketentuan ini dapat dikenakan sanksi sesuai kebijakan perusahaan.
                </Text>
              </View>
            </ScrollView>

          </View>
        </View>
      </AnimatedModal>

      {/* ── MODAL: Pergantian Bulan ── */}
      <AnimatedModal visible={newMonthModal} animStyle="dialog" onRequestClose={() => setNewMonthModal(false)}
        statusBarTranslucent hardwareAccelerated backdropColor="rgba(0,0,0,0.6)">
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:28 }} pointerEvents="box-none">
          <View style={{ width:'100%', backgroundColor:C.surface, borderRadius:28, padding:24,
            alignItems:'center', gap:14,
            shadowColor:'#000', shadowOffset:{width:0,height:20}, shadowOpacity:0.4, shadowRadius:40, elevation:24,
            borderWidth:1.5, borderColor:C.borderStrong }}>

            {/* Icon */}
            <View style={{ width:64, height:64, borderRadius:22,
              backgroundColor:C.warningBg, alignItems:'center', justifyContent:'center',
              borderWidth:2, borderColor:`${C.warning}50` }}>
              <Ionicons name="time-outline" size={30} color={C.warning} />
            </View>

            {/* Badge bulan */}
            <View style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20,
              backgroundColor:C.warningBg, borderWidth:1.5, borderColor:`${C.warning}50` }}>
              <Text style={{ fontSize:13, fontWeight:'800', color:C.warning, letterSpacing:0.3 }}>
                📅 Periode {nowMonth} {nowYear}
              </Text>
            </View>

            {/* Judul */}
            <View style={{ alignItems:'center', gap:6 }}>
              <Text style={{ fontSize:18, fontWeight:'900', color:C.text, letterSpacing:-0.3, textAlign:'center' }}>
                Bulan Baru, Folder Baru!
              </Text>
              <Text style={{ fontSize:13.5, color:C.textSub, lineHeight:22, textAlign:'center', fontWeight:'500' }}>
                Kamu sudah memasuki periode{' '}
                <Text style={{ fontWeight:'800', color:C.warning }}>
                  {nowMonth} {nowYear}
                </Text>
                .{'\n\n'}
                Pastikan kamu memperbarui{' '}
                <Text style={{ fontWeight:'800', color:C.text }}>link folder Google Drive</Text>
                {' '}tujuan upload di menu{' '}
                <Text style={{ fontWeight:'800', color:C.accent }}>Pengaturan</Text>
                {' '}sesuai bulan ini, agar dokumen BPK tidak masuk ke folder bulan yang salah.
              </Text>
            </View>

            {/* Info box */}
            <View style={{ width:'100%', backgroundColor:C.surfaceAlt, borderRadius:14,
              borderWidth:1.5, borderColor:C.border, padding:14, flexDirection:'row', gap:10, alignItems:'flex-start' }}>
              <View style={{ width:26, height:26, borderRadius:8, backgroundColor:C.accentLight,
                borderWidth:1.5, borderColor:C.borderStrong,
                alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <Ionicons name="information-outline" size={14} color={C.accent} />
              </View>
              <Text style={{ flex:1, fontSize:12, color:C.textSub, lineHeight:18, fontWeight:'500' }}>
                Pesan ini muncul otomatis setiap awal bulan sebagai pengingat pergantian periode folder Drive.
              </Text>
            </View>

            {/* Tombol */}
            <View style={{ flexDirection:'row', gap:10, width:'100%', marginTop:2 }}>
              <ScaleBtn onPress={() => setNewMonthModal(false)} style={{ flex:1 }}
                innerStyle={{ height:50, borderRadius:15, borderWidth:1.5,
                  borderColor:C.border, backgroundColor:C.surfaceAlt,
                  alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontSize:14, fontWeight:'700', color:C.textSub }}>Nanti</Text>
              </ScaleBtn>
              <ScaleBtn
                onPress={() => {
                  setNewMonthModal(false);
                  setTimeout(() => handleTabChange('settings'), 200);
                }}
                style={{ flex:2 }}
                innerStyle={{ height:50, borderRadius:15, paddingHorizontal:10,
                  backgroundColor:C.warning,
                  alignItems:'center', justifyContent:'center',
                  flexDirection:'row', gap:6 }}>
                <Ionicons name="folder-open-outline" size={16} color="#fff" />
                <Text style={{ fontSize:13, fontWeight:'800', color:'#fff' }} numberOfLines={1} adjustsFontSizeToFit>Perbarui Folder Sekarang</Text>
              </ScaleBtn>
            </View>

          </View>
        </View>
      </AnimatedModal>

      {/* ── MODAL: Tentang Aplikasi ── */}
      <AnimatedModal visible={aboutModal} animStyle="sheet" swipeToClose
        onRequestClose={() => setAboutModal(false)}
        statusBarTranslucent hardwareAccelerated backdropColor="rgba(0,0,0,0.55)">
        <View style={{ flex:1, justifyContent:'flex-end' }} pointerEvents="box-none">
          <View style={{ backgroundColor:C.surface, borderTopLeftRadius:28, borderTopRightRadius:28,
            maxHeight:'90%', paddingBottom:34,
            shadowColor:'#000', shadowOffset:{width:0,height:-8}, shadowOpacity:0.2, shadowRadius:24, elevation:20 }}>
            <View style={{ paddingTop:20, paddingHorizontal:24 }}>
              <View style={{ width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginBottom:16 }} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:24, paddingBottom:8 }} showsVerticalScrollIndicator={false} overScrollMode="never">
              {renderAboutContent()}
            </ScrollView>
          </View>
        </View>
      </AnimatedModal>

      {/* ── MODAL: Pilih Mode Kamera ── */}
      <AnimatedModal visible={cameraModeModal} animStyle="sheet" swipeToClose
        onRequestClose={() => setCameraModeModal(false)}
        backdropColor="rgba(0,0,0,0.6)">
        <View style={{ flex:1, justifyContent:'flex-end' }} pointerEvents="box-none">
          <View style={{ backgroundColor:C.surface, borderTopLeftRadius:28, borderTopRightRadius:28,
            paddingBottom:36, paddingTop:8,
            shadowColor:'#000', shadowOffset:{width:0,height:-8}, shadowOpacity:0.25, shadowRadius:24, elevation:20 }}>
            {/* drag handle */}
            <View style={{ width:40, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:'center', marginBottom:16 }} />
            <View style={{ paddingHorizontal:24, gap:14 }}>
              <Text style={{ fontSize:17, fontWeight:'900', color:C.text, letterSpacing:-0.3, textAlign:'center' }}>
                Pilih Mode Kamera
              </Text>
              <Text style={{ fontSize:12.5, color:C.textSub, textAlign:'center', lineHeight:18, fontWeight:'500' }}>
                Single untuk satu foto, Batch untuk banyak foto sekaligus
              </Text>

              {/* Single */}
              <ScaleBtn onPress={() => {
                  setScanMode('single');
                  setCameraModeModal(false);
                  setScannerOpen(true);
                }}
                style={{
                  borderRadius:16,
                  shadowColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)',
                  shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:10, elevation:6,
                }}
                innerStyle={{ height:56, borderRadius:16, backgroundColor:C.accent,
                  flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10 }}>
                <View style={{ width:32, height:32, borderRadius:10, backgroundColor:C.accentOverlay,
                  alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="camera-outline" size={18} color={C.accentContrast} />
                </View>
                <View>
                  <Text style={{ color:C.accentContrast, fontWeight:'900', fontSize:15, letterSpacing:-0.2 }}>Single</Text>
                  <Text style={{ color:C.accentSubText, fontWeight:'600', fontSize:11 }}>Satu foto per sesi</Text>
                </View>
              </ScaleBtn>

              {/* Batch */}
              <ScaleBtn onPress={() => {
                  setScanMode('batch');
                  setCameraModeModal(false);
                  setScannerOpen(true);
                }}
                style={{
                  borderRadius:16,
                  shadowColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)',
                  shadowOffset:{width:0,height:4}, shadowOpacity:1, shadowRadius:10, elevation:6,
                }}
                innerStyle={{ height:56, borderRadius:16, backgroundColor:C.accent,
                  flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10 }}>
                <View style={{ width:32, height:32, borderRadius:10, backgroundColor:C.accentOverlay,
                  alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="images-outline" size={18} color={C.accentContrast} />
                </View>
                <View>
                  <Text style={{ color:C.accentContrast, fontWeight:'900', fontSize:15, letterSpacing:-0.2 }}>Batch</Text>
                  <Text style={{ color:C.accentSubText, fontWeight:'600', fontSize:11 }}>Banyak foto sekaligus</Text>
                </View>
              </ScaleBtn>

            </View>
          </View>
        </View>
      </AnimatedModal>

      {/*
        ── SCANNER MODAL ──
        Dibungkus RN Modal agar punya native window layer sendiri.
        Ini MENJAMIN scanner selalu render di atas:
          • Header ber-elevation (Android elevation system)
          • AnimatedModal "Pilih Mode Kamera" yang sedang animasi keluar
          • Semua konten SafeAreaView lainnya
        animationType="none" → transisi dihandle ScannerScreen sendiri
      */}
      <Modal
        visible={scannerOpen}
        transparent={false}
        animationType="none"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
          <ScannerScreen
            onCapture={handleScanCapture}
            onClose={() => setScannerOpen(false)}
            dark={dark}
            mode={scanMode}
            hideModePicker={true}
          />
          {/* ── Tombol Back/Kembali overlay ── */}
          <ScaleBtn
            onPress={() => setScannerOpen(false)}
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 54 : 36,
              left: 16,
              zIndex: 9999,
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8, elevation: 10,
            }}
            innerStyle={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(0,0,0,0.58)',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </ScaleBtn>
        </View>
      </Modal>

      {/* ── MODAL: konfirmasi hapus foto ── */}
      <AnimatedModal visible={deletePhotoIdx !== null} animStyle="dialog"
        onRequestClose={() => setDeletePhotoIdx(null)} statusBarTranslucent hardwareAccelerated>
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:C.border }]} onPress={() => {}}>
            <View style={[mds.iconWrap, { backgroundColor:C.dangerBg, borderColor:`${C.danger}40` }]}>
              <Ionicons name="image-outline" size={28} color={C.danger} />
            </View>
            <Text style={[mds.title, { color:C.text }]}>Hapus Foto Ini?</Text>
            <Text style={[mds.desc, { color:C.textSub }]}>
              Foto{deletePhotoIdx !== null ? ` #${deletePhotoIdx + 1}` : ''} akan dihapus dari lampiran BPK.
              {'\n'}Tindakan ini tidak dapat dibatalkan.
            </Text>
            <View style={mds.btnRow}>
              <ScaleBtn onPress={() => setDeletePhotoIdx(null)} style={mds.flex1}
                innerStyle={[mds.btnCancel, { borderColor:C.border, backgroundColor:C.surfaceAlt }]}>
                <Text style={[mds.btnCancelText, { color:C.textSub }]}>Batal</Text>
              </ScaleBtn>
              <ScaleBtn
                onPress={() => {
                  if (deletePhotoIdx !== null) {
                    LayoutAnimation.configureNext(LA_SPRING);
                    setPhotos(p => p.filter((_,j) => j !== deletePhotoIdx));
                    showToast(`Foto #${deletePhotoIdx + 1} berhasil dihapus`, 'info', 1600);
                  }
                  setDeletePhotoIdx(null);
                }}
                style={mds.flex1}
                innerStyle={[mds.btnConfirm, { backgroundColor:C.danger }]}>
                <Text style={mds.btnConfirmText}>Hapus</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: konfirmasi duplikat No. BPK ── */}
      <AnimatedModal
        visible={duplikatModal !== null}
        animStyle="zoom"
        onRequestClose={() => { setBridgeGrey(false); setDuplikatModal(null); }}
      >
        <View style={mds.overlay} pointerEvents="box-none">
          <Pressable style={[mds.box, { backgroundColor:C.surface, borderColor:'#FDE68A' }]} onPress={() => {}}>
            {/* Icon peringatan */}
            <View style={[mds.iconWrap, { backgroundColor:'#FEF3C7', borderColor:'#FDE68A' }]}>
              <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
            </View>

            {/* Badge sumber info — selalu Drive */}
            <View style={{
              flexDirection:'row', alignItems:'center', gap:4,
              paddingHorizontal:10, paddingVertical:4, borderRadius:20,
              backgroundColor: '#ECFDF5', borderWidth:1, borderColor:'#6EE7B7',
              marginTop:-4,
            }}>
              <Ionicons name="cloud-done-outline" size={11} color="#059669" />
              <Text style={{ fontSize:11, fontWeight:'600', color:'#059669' }}>
                Terdeteksi di Google Drive
              </Text>
            </View>

            {/* Judul */}
            <Text style={[mds.title, { color:C.text }]}>No. BPK Sudah Ada!</Text>

            {/* Deskripsi informatif */}
            <Text style={[mds.desc, { color:C.textSub }]}>
              File{' '}
              <Text style={{ fontWeight:'800', color:C.text }}>
                {duplikatModal?.noBpk}.pdf
              </Text>
              {' '}sudah tersimpan di Google Drive sejak{' '}
              <Text style={{ fontWeight:'700', color:C.text }}>
                {duplikatModal
                  ? new Date(duplikatModal.uploadedAt)
                      .toLocaleDateString('id-ID', {
                        day:'2-digit', month:'long', year:'numeric',
                        hour:'2-digit', minute:'2-digit',
                      })
                  : ''}
              </Text>
              .{'\n\n'}
              Jika kamu lanjutkan,{' '}
              <Text style={{ fontWeight:'700', color:'#D97706' }}>isi file lama akan diganti</Text>
              {' '}dengan yang baru — namun{' '}
              <Text style={{ fontWeight:'700', color:C.text }}>link Google Drive tidak berubah</Text>
              , sehingga laporan finance yang sudah mencatat link tersebut tetap valid.
            </Text>

            {/* Separator */}
            <View style={{ width:'100%', height:1, backgroundColor:C.border, marginVertical:2 }} />

            {/* Tombol aksi */}
            <View style={mds.btnRow}>
              {/* Batal */}
              <ScaleBtn
                onPress={() => { setBridgeGrey(false); setDuplikatModal(null); }}
                style={mds.flex1}
                innerStyle={[mds.btnCancel, { borderColor:C.border, backgroundColor:C.surfaceAlt }]}
              >
                <Text style={[mds.btnCancelText, { color:C.textSub }]}>Batal</Text>
              </ScaleBtn>

              {/* Ya, Timpa */}
              <ScaleBtn
                onPress={() => {
                  const d = duplikatModal;
                  // bridgeGrey tetap true selama jeda animasi modal keluar (200ms backdrop)
                  // buffer +20ms untuk safety — di-reset di dalam doUpload()
                  setDuplikatModal(null);
                  setTimeout(() => {
                    doUpload(d?.driveId, d?.histId || undefined);
                  }, 220);
                }}
                style={mds.flex1}
                innerStyle={[mds.btnConfirm, { backgroundColor:'#D97706' }]}
              >
                <Text style={mds.btnConfirmText}>Ya, Timpa</Text>
              </ScaleBtn>
            </View>
          </Pressable>
        </View>
      </AnimatedModal>

      {/* ── MODAL: upload progress ── */}
      <AnimatedModal visible={uploading} animStyle="zoom" backdropColor="rgba(0,0,0,0.65)">
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32 }} pointerEvents="box-none">
          <UploadProgressModal
            C={C}
            uploadPhase={uploadPhase}
            uploadProgressAnim={uploadProgressAnim}
            photoCount={photos.length}
          />
        </View>
      </AnimatedModal>

      {toast && <ToastNotification key={toastId} config={toast} dark={dark} onHide={() => setToast(null)} />}
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
