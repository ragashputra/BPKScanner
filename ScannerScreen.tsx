/**
 * ScannerScreen.tsx — BPK Scanner
 *
 * Flow:
 * 1. User pilih mode Single / Batch → tap "Buka Scanner"
 * 2. MLKit buka (SCANNER_MODE_FULL: edge detection + auto crop + ML enhance)
 * 3. User tap Done → MLKit processing selesai → phase 'done' tampil INSTAN
 *    └─ Success UI mengisi gap OS Activity transition → zero black flash
 * 4. 300ms kemudian: onClose() → Modal tutup → onCapture() → foto masuk
 *
 * Root cause black flash:
 *   MLKit berjalan sebagai Android Activity terpisah. Saat finish, OS
 *   Activity transition terjadi sebelum JS promise resolve. Gap itu yang
 *   bikin Modal hitam kelihatan sebentar. Phase 'done' menutup gap itu.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, Platform, Animated, Easing,
} from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  onCapture:       (uris: string[]) => void;
  onClose:         () => void;
  dark?:           boolean;
  mode?:           'single' | 'batch';
  hideModePicker?: boolean;
}

type Phase = 'idle' | 'scanning' | 'done';

// ─────────────────────────────────────────────────────────────────────────────
export default function ScannerScreen({ onCapture, onClose, mode, hideModePicker }: Props) {
  const [isBatch, setIsBatch]     = useState(mode === 'batch');
  const [phase, setPhase]         = useState<Phase>('idle');
  const [doneCount, setDoneCount] = useState(0);
  const hasAutoStarted            = useRef(false);
  const capturedUris              = useRef<string[]>([]);

  // Animasi fade-in untuk done screen — masuk smooth, bukan pop tiba-tiba
  const doneOpacity = useRef(new Animated.Value(0)).current;

  // Sync isBatch kalau mode prop berubah dari luar
  useEffect(() => {
    if (mode !== undefined) setIsBatch(mode === 'batch');
  }, [mode]);

  const startScan = useCallback(async () => {
    setPhase('scanning');
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments:   isBatch ? 20 : 1,
        responseType:      'imageFilePath',
        letUserAdjustCrop: true,
        // colorMode: 'color' → MLKit SCANNER_MODE_FULL mengembalikan gambar
        // berwarna — tanpa ini beberapa versi plugin fallback ke mode lain
        colorMode: 'color',
      });

      if (!scannedImages || scannedImages.length === 0) {
        setPhase('idle');
        onClose();
        return;
      }

      // ── Phase 'done': kunci fix black flash ────────────────────────────────
      // Timeline masalah (tanpa fix):
      //   MLKit Activity finish → OS Activity transition → Modal hitam kelihatan
      //   → [beberapa frame] → JS promise resolve → onClose() → app muncul
      //
      // Timeline dengan fix:
      //   MLKit Activity finish → JS promise resolve → setPhase('done')
      //   → Success UI muncul INSTAN → menutup gap OS transition
      //   → 300ms kemudian → onClose() + onCapture()
      //
      // 300ms = cukup untuk cover OS transition (200–250ms) + visual feedback
      capturedUris.current = scannedImages;
      setDoneCount(scannedImages.length);
      setPhase('done');

      // Fade-in done screen (60ms) — smooth, tidak pop tiba-tiba
      doneOpacity.setValue(0);
      Animated.timing(doneOpacity, {
        toValue: 1, duration: 60,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      // Setelah 300ms: tutup modal → kirim data ke parent
      setTimeout(() => {
        onClose();
        // requestAnimationFrame: pastikan setScannerOpen(false) sudah diproses
        // RN sebelum setPhotos + LayoutAnimation di handleScanCapture berjalan
        requestAnimationFrame(() => onCapture(capturedUris.current));
      }, 300);

    } catch (e) {
      console.error('Scanner error:', e);
      setPhase('idle');
      onClose();
    }
  }, [isBatch, onCapture, onClose]);

  // Auto-start: kalau hideModePicker=true (mode sudah dipilih dari App.tsx),
  // langsung panggil startScan — tidak perlu delay karena parent Modal
  // pakai animationType="none" (instant)
  useEffect(() => {
    if (hideModePicker && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Render: done ────────────────────────────────────────────────────────────
  // Muncul tepat saat MLKit selesai → menutup gap OS Activity transition
  if (phase === 'done') {
    return (
      <Animated.View style={[s.center, { opacity: doneOpacity }]}>
        <View style={s.successIconWrap}>
          <Ionicons name="checkmark-circle" size={64} color="#4ADE80" />
        </View>
        <Text style={s.doneTitle}>Scan Berhasil</Text>
        <Text style={s.doneSub}>
          {doneCount} foto siap ditambahkan ke lampiran
        </Text>
        <View style={s.doneSpinnerRow}>
          <ActivityIndicator size="small" color="#4ADE80" />
          <Text style={s.doneSpinnerText}>Menambahkan...</Text>
        </View>
      </Animated.View>
    );
  }

  // ── Render: idle / scanning + hideModePicker ────────────────────────────────
  // Tidak tampilkan apapun — parent Modal sudah punya background hitam.
  // Native camera (DocumentScanner) akan terbuka langsung di atasnya.
  if (hideModePicker && (phase === 'idle' || phase === 'scanning')) {
    return null;
  }

  // ── Render: scanning tanpa hideModePicker (edge case manual flow) ───────────
  if (phase === 'scanning') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7C78FB" />
        <Text style={s.loadTitle}>Membuka scanner...</Text>
      </View>
    );
  }

  // ── Render: idle — mode picker ───────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="close" size={22} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Icon */}
      <View style={s.iconWrap}>
        <View style={s.iconBg}>
          <Ionicons name="scan" size={48} color="#7C78FB" />
        </View>
      </View>

      {/* Title */}
      <Text allowFontScaling={false} style={s.title}>Scan Dokumen</Text>
      <Text style={s.sub}>
        Pilih mode scan lalu buka kamera.{'\n'}
        Kamera akan otomatis mendeteksi tepi dokumen.
      </Text>

      {/* Toggle Single / Batch */}
      <View style={s.toggleWrap}>
        <Pressable
          style={[s.toggleBtn, !isBatch && s.toggleActive]}
          onPress={() => setIsBatch(false)}
        >
          <Ionicons name="document-outline" size={18} color={!isBatch ? '#fff' : '#6B7280'} />
          <Text allowFontScaling={false} style={[s.toggleText, !isBatch && s.toggleTextActive]}>Single</Text>
        </Pressable>
        <Pressable
          style={[s.toggleBtn, isBatch && s.toggleActive]}
          onPress={() => setIsBatch(true)}
        >
          <Ionicons name="layers-outline" size={18} color={isBatch ? '#fff' : '#6B7280'} />
          <Text allowFontScaling={false} style={[s.toggleText, isBatch && s.toggleTextActive]}>Batch</Text>
        </Pressable>
      </View>

      {/* Mode description */}
      <Text style={s.modeDesc}>
        {isBatch
          ? 'Scan banyak halaman sekaligus dalam satu sesi'
          : 'Scan satu dokumen, langsung selesai'}
      </Text>

      {/* Buka Scanner button */}
      <Pressable style={s.scanBtn} onPress={startScan}>
        <Ionicons name="camera" size={22} color="#fff" />
        <Text allowFontScaling={false} style={s.scanBtnText}>Buka Scanner</Text>
      </Pressable>

      {/* Info enhance */}
      <View style={s.infoRow}>
        <Ionicons name="checkmark-circle" size={15} color="#4ADE80" />
        <Text style={s.infoText}>Auto enhance by MLKit: kontras, tajam & warna tetap terjaga</Text>
      </View>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080B18',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#080B18',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },

  // Header
  header: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Icon
  iconWrap: { marginTop: 16, marginBottom: 24 },
  iconBg: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: 'rgba(124,120,251,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(124,120,251,0.25)',
  },

  // Text
  title: {
    color: '#EEF0FF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  sub: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  // Toggle Single/Batch
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 11,
  },
  toggleActive: {
    backgroundColor: '#5A54F9',
    shadowColor: '#5A54F9',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  toggleText:       { color: '#6B7280', fontSize: 14, fontWeight: '700' },
  toggleTextActive: { color: '#fff' },

  // Mode description
  modeDesc: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Scan button
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#5A54F9',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#5A54F9',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginBottom: 16,
  },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
  },
  infoText: { color: '#4ADE80', fontSize: 12, fontWeight: '500' },

  // Done / Success screen
  successIconWrap: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  doneTitle: {
    color: '#EEF0FF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  doneSub: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneSpinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'rgba(74,222,128,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
  },
  doneSpinnerText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },

  // Loading
  loadTitle: { color: '#EEF0FF', fontSize: 16, fontWeight: '700' },
  loadSub:   { color: '#6B7280', fontSize: 13, textAlign: 'center' },
});
