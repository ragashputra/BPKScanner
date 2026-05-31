import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, Switch, ActivityIndicator,
  SafeAreaView, Platform, Animated, Dimensions, Modal,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = '596727618114-e1k1jg3shvusc5mboenr4egt8pcqi6f9.apps.googleusercontent.com';
const WEB_CLIENT_ID     = '596727618114-m494mn8i75gfh9lon7cfu1sa4r6aoo0h.apps.googleusercontent.com';

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const KEY_UNIT     = '@bpk_unit_usaha';
const KEY_FOLDER   = '@bpk_folder_id';
const KEY_ACCESS   = '@bpk_access_token';
const KEY_REFRESH  = '@bpk_refresh_token';
const KEY_DARK     = '@bpk_dark_mode';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
  revocationEndpoint:    'https://oauth2.googleapis.com/revoke',
};

// ─── Theme ───────────────────────────────────────────────────────────────────
const LIGHT = {
  bg:          '#F7F8FA',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F0F2F5',
  border:      '#E8EAED',
  text:        '#111827',
  textSub:     '#6B7280',
  textMuted:   '#9CA3AF',
  accent:      '#2563EB',
  accentLight: '#EFF6FF',
  accentText:  '#1D4ED8',
  success:     '#16A34A',
  successBg:   '#F0FDF4',
  danger:      '#DC2626',
  dangerBg:    '#FEF2F2',
  headerBg:    '#FFFFFF',
  shadow:      '#00000010',
};

const DARK = {
  bg:          '#0F1117',
  surface:     '#1C1E26',
  surfaceAlt:  '#252830',
  border:      '#2E3039',
  text:        '#F1F3F9',
  textSub:     '#9BA3AF',
  textMuted:   '#6B7280',
  accent:      '#3B82F6',
  accentLight: '#1E3A5F',
  accentText:  '#93C5FD',
  success:     '#22C55E',
  successBg:   '#052E16',
  danger:      '#EF4444',
  dangerBg:    '#450A0A',
  headerBg:    '#1C1E26',
  shadow:      '#00000040',
};

// ─── Dark Mode Toggle ─────────────────────────────────────────────────────────
function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(dark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: dark ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  }, [dark]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#D1D5DB', '#3B82F6'] });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
      <Animated.View style={[styles.toggleTrack, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.toggleThumb, { transform: [{ translateX }] }]}>
          <Text style={{ fontSize: 10 }}>{dark ? '🌙' : '☀️'}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Icon SVG Components (Text-based minimal icons) ───────────────────────────
function Icon({ name, size = 18, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, string> = {
    google: 'G', upload: '↑', camera: '◎', gallery: '⊞', eye: '◉',
    trash: '✕', check: '✓', logout: '→', settings: '⚙', folder: '▤',
    doc: '▤', plus: '+', back: '←', save: '✓', key: '⬡',
  };
  return (
    <Text style={{ fontSize: size, color, fontWeight: '700', lineHeight: size + 4 }}>
      {icons[name] || '•'}
    </Text>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]               = useState(false);
  const [tab, setTab]                 = useState<'home' | 'settings'>('home');
  const [currentTime, setCurrentTime] = useState(new Date());

  // BPK state
  const [unitUsaha, setUnitUsaha]     = useState('');
  const [unitInput, setUnitInput]     = useState('');
  const [unitSaved, setUnitSaved]     = useState(false);
  const [noBpkUrut, setNoBpkUrut]     = useState('');
  const [isAutoNoBpk, setIsAutoNoBpk] = useState(true);
  const [noBpkManual, setNoBpkManual] = useState('');
  const [photos, setPhotos]           = useState<string[]>([]);

  // Drive state
  const [folderId, setFolderId]       = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [folderSaved, setFolderSaved] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const C = dark ? DARK : LIGHT;

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'com.bpkscanner',
    path: 'oauth2redirect',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     ANDROID_CLIENT_ID,
      redirectUri,
      scopes:       ['https://www.googleapis.com/auth/drive.file', 'openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      accessType:   'offline',
      prompt:       AuthSession.Prompt.Consent,
    },
    discovery,
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSaved();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      exchangeCode(response.params.code);
    } else if (response?.type === 'error') {
      console.log('Auth error:', JSON.stringify(response.error));
      Alert.alert('Auth Error', JSON.stringify(response.error));
    }
  }, [response]);

  const loadSaved = async () => {
    try {
      const [unit, folder, access, refresh, darkPref] = await Promise.all([
        AsyncStorage.getItem(KEY_UNIT),
        AsyncStorage.getItem(KEY_FOLDER),
        AsyncStorage.getItem(KEY_ACCESS),
        AsyncStorage.getItem(KEY_REFRESH),
        AsyncStorage.getItem(KEY_DARK),
      ]);
      if (unit)     { setUnitUsaha(unit); setUnitInput(unit); setUnitSaved(true); }
      if (folder)   { setFolderId(folder); setFolderInput(folder); setFolderSaved(true); }
      if (access)   setAccessToken(access);
      if (refresh)  { setRefreshToken(refresh); setIsLoggedIn(true); }
      if (darkPref) setDark(darkPref === 'true');
    } catch (e) {}
  };

  const toggleDark = async () => {
    const next = !dark;
    setDark(next);
    await AsyncStorage.setItem(KEY_DARK, String(next));
  };

  const exchangeCode = async (code: string) => {
    setAuthLoading(true);
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:    ANDROID_CLIENT_ID,
          redirect_uri: redirectUri,
          grant_type:   'authorization_code',
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await AsyncStorage.setItem(KEY_ACCESS, data.access_token);
        setAccessToken(data.access_token);
        if (data.refresh_token) {
          await AsyncStorage.setItem(KEY_REFRESH, data.refresh_token);
          setRefreshToken(data.refresh_token);
        }
        setIsLoggedIn(true);
        Alert.alert('Berhasil', 'Akun Google terhubung');
      } else {
        Alert.alert('Login Gagal', data.error_description || JSON.stringify(data));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id:     ANDROID_CLIENT_ID,
          grant_type:    'refresh_token',
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await AsyncStorage.setItem(KEY_ACCESS, data.access_token);
        setAccessToken(data.access_token);
        return data.access_token;
      }
    } catch (e) {}
    return null;
  };

  const getValidToken = async (): Promise<string | null> => {
    if (accessToken) return accessToken;
    return await refreshAccessToken();
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH]);
    setAccessToken(''); setRefreshToken(''); setIsLoggedIn(false);
  };

  const formatDate = (d: Date) =>
    `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  const formatTime = (d: Date) =>
    [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2,'0')).join(':');

  const getAutoBpk = () => {
    const now = new Date();
    return `${(noBpkUrut || '0').padStart(4,'0')}/${unitUsaha || 'UNIT'}/${ROMAN_MONTHS[now.getMonth()]}/${now.getFullYear()}`;
  };

  const getNoBpk = () => isAutoNoBpk ? getAutoBpk() : (noBpkManual || '(belum diisi)');

  const getFileName = () => getNoBpk().replace(/\//g, '-') + '.pdf';

  const saveUnit = async () => {
    if (!unitInput.trim()) return Alert.alert('Error', 'Nama Unit Usaha tidak boleh kosong');
    const val = unitInput.trim().toUpperCase();
    await AsyncStorage.setItem(KEY_UNIT, val);
    setUnitUsaha(val); setUnitSaved(true);
  };

  const saveFolder = async () => {
    if (!folderInput.trim()) return Alert.alert('Error', 'Folder ID tidak boleh kosong');
    await AsyncStorage.setItem(KEY_FOLDER, folderInput.trim());
    setFolderId(folderInput.trim()); setFolderSaved(true);
    Alert.alert('Tersimpan', 'Folder Drive berhasil disimpan');
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Izin', 'Izin kamera diperlukan');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled) setPhotos(p => [...p, result.assets[0].uri]);
  };

  const pickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Izin', 'Izin galeri diperlukan');
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85, allowsMultipleSelection: true,
    });
    if (!result.canceled) setPhotos(p => [...p, ...result.assets.map((a: any) => a.uri)]);
  };

  const buildPdf = async (): Promise<string> => {
    const noBpk = getNoBpk();
    const imgs = await Promise.all(photos.map(async (uri, i) => {
      // Fix base64 prefix — detect format dari uri
      const isJpeg = uri.toLowerCase().includes('.jpg') || uri.toLowerCase().includes('.jpeg');
      const isPng  = uri.toLowerCase().includes('.png');
      const mime   = isPng ? 'image/png' : 'image/jpeg';
      const b64    = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return `<div style="page-break-inside:avoid;margin-bottom:20px;">
        <p style="font-size:11px;color:#888;margin:0 0 6px;font-family:sans-serif;">Lampiran ${i + 1}</p>
        <img src="data:${mime};base64,${b64}" style="width:100%;max-height:680px;object-fit:contain;border-radius:4px;"/>
      </div>`;
    }));

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
  .header { border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; }
  .title { font-size: 18px; font-weight: bold; color: #2563EB; }
  .subtitle { font-size: 12px; color: #6B7280; margin-top: 4px; }
  .row { display: flex; gap: 32px; margin-bottom: 20px; }
  .field .lbl { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; }
  .field .val { font-size: 14px; font-weight: 600; color: #111; margin-top: 2px; }
  .section-title { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; border-top: 1px solid #E5E7EB; padding-top: 20px; }
</style>
</head><body>
<div class="header">
  <div class="title">Bukti Pengeluaran Kas</div>
  <div class="subtitle">Dicetak: ${formatDate(new Date())} pukul ${formatTime(new Date())}</div>
</div>
<div class="row">
  <div class="field"><div class="lbl">Nomor BPK</div><div class="val">${noBpk}</div></div>
  <div class="field"><div class="lbl">Unit Usaha</div><div class="val">${unitUsaha || '-'}</div></div>
</div>
<div class="section-title">Lampiran Foto (${photos.length})</div>
${imgs.join('\n')}
</body></html>`;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  const previewPdf = async () => {
    if (photos.length === 0) return Alert.alert('Info', 'Belum ada foto lampiran');
    setUploading(true);
    try {
      const uri = await buildPdf();
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Preview BPK' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadToDrive = async () => {
    if (photos.length === 0) return Alert.alert('Info', 'Belum ada foto lampiran');
    if (!folderId)           return Alert.alert('Info', 'Folder Drive ID belum diisi di Pengaturan');
    if (!isLoggedIn)         return Alert.alert('Info', 'Login Google dulu');
    setUploading(true);
    try {
      let token = await getValidToken();
      if (!token) { Alert.alert('Error', 'Sesi expired, login ulang'); return; }

      const pdfUri  = await buildPdf();
      const fileName = getFileName();
      // Nama file di Drive pakai / agar terbaca natural di Drive
      const driveFileName = getNoBpk() + '.pdf';
      const metadata = JSON.stringify({ name: driveFileName, parents: [folderId], mimeType: 'application/pdf' });
      const boundary = 'bpk_boundary_x';
      const pdfB64   = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });

      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdfB64}\r\n` +
        `--${boundary}--`;

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body }
      );
      const result = await res.json();

      if (res.ok && result.id) {
        Alert.alert('Upload Berhasil ✓', `${driveFileName}`);
        setPhotos([]); setNoBpkUrut(''); setNoBpkManual('');
      } else if (result.error?.code === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) Alert.alert('Error', 'Sesi expired, login ulang');
        else Alert.alert('Info', 'Token diperbarui, coba upload lagi');
      } else {
        Alert.alert('Upload Gagal', result.error?.message || 'Terjadi kesalahan');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  // ─── Styles dynamic ──────────────────────────────────────────────────────────
  const ds = {
    safe:        { flex: 1, backgroundColor: C.bg },
    header: {
      backgroundColor: C.headerBg,
      paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 32) + 8 : 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '700' as const, color: C.text, letterSpacing: -0.3 },
    headerSub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },
    headerRight: { alignItems: 'flex-end' as const },
    clock:       { fontSize: 13, fontWeight: '600' as const, color: C.textSub, fontVariant: ['tabular-nums'] as any },

    tabBar: {
      flexDirection: 'row' as const,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    tabBtn: (active: boolean) => ({
      flex: 1, paddingVertical: 12, alignItems: 'center' as const,
      borderBottomWidth: 2,
      borderBottomColor: active ? C.accent : 'transparent',
    }),
    tabLabel: (active: boolean) => ({
      fontSize: 13, fontWeight: active ? '600' as const : '400' as const,
      color: active ? C.accent : C.textMuted,
    }),

    scroll:   { flex: 1 },
    content:  { padding: 16, paddingBottom: 40 },

    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 12 },
    cardTitle: { fontSize: 13, fontWeight: '600' as const, color: C.text },
    cardSub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },

    label:   { fontSize: 11, color: C.textMuted, marginBottom: 6, fontWeight: '500' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
    input: {
      borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 11,
      fontSize: 14, color: C.text, backgroundColor: C.surfaceAlt,
    },
    inputRow: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },

    btnPrimary: {
      backgroundColor: C.accent, borderRadius: 10,
      paddingVertical: 13, alignItems: 'center' as const,
      flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '600' as const, fontSize: 14 },

    btnOutline: {
      borderWidth: 1.5, borderColor: C.accent, borderRadius: 10,
      paddingVertical: 13, alignItems: 'center' as const,
      flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 8,
    },
    btnOutlineText: { color: C.accent, fontWeight: '600' as const, fontSize: 14 },

    btnSmall: {
      backgroundColor: C.accent, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    btnSmallText: { color: '#fff', fontWeight: '600' as const, fontSize: 13 },

    btnDanger: {
      borderWidth: 1, borderColor: C.danger, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    btnDangerText: { color: C.danger, fontWeight: '600' as const, fontSize: 13 },

    badge: (type: 'success' | 'accent') => ({
      backgroundColor: type === 'success' ? C.successBg : C.accentLight,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    }),
    badgeText: (type: 'success' | 'accent') => ({
      fontSize: 12, fontWeight: '600' as const,
      color: type === 'success' ? C.success : C.accentText,
    }),

    previewBox: {
      backgroundColor: C.accentLight, borderRadius: 10,
      padding: 12, marginTop: 8,
    },
    previewLabel: { fontSize: 10, color: C.textMuted, marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
    previewValue: { fontSize: 16, fontWeight: '700' as const, color: C.accent, letterSpacing: -0.2 },

    thumbWrap: { marginRight: 10, position: 'relative' as const },
    thumb:     { width: 76, height: 76, borderRadius: 10, backgroundColor: C.surfaceAlt },
    removeBtn: {
      position: 'absolute' as const, top: -5, right: -5,
      backgroundColor: C.danger, borderRadius: 10,
      width: 20, height: 20, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    thumbIdx: {
      position: 'absolute' as const, bottom: 4, left: 4,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4,
      paddingHorizontal: 4, paddingVertical: 1,
    },
    thumbIdxText: { color: '#fff', fontSize: 9, fontWeight: '700' as const },

    infoBar: {
      backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: C.border,
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginTop: 10,
    },
    infoBarLabel: { fontSize: 11, color: C.textMuted },
    infoBarValue: { fontSize: 13, fontWeight: '600' as const, color: C.text },

    divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
    row2: { flexDirection: 'row' as const, gap: 10 },
    flex1: { flex: 1 },
  };

  // ─── HOME TAB ─────────────────────────────────────────────────────────────
  const renderHome = () => (
    <ScrollView style={ds.scroll} contentContainerStyle={ds.content} showsVerticalScrollIndicator={false}>

      {/* AKUN GOOGLE */}
      <View style={ds.card}>
        <View style={ds.cardRow}>
          <View>
            <Text style={ds.cardTitle}>Akun Google Drive</Text>
            <Text style={ds.cardSub}>Diperlukan untuk upload</Text>
          </View>
          {isLoggedIn ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={ds.badge('success')}>
                <Text style={ds.badgeText('success')}>✓ Terhubung</Text>
              </View>
              <TouchableOpacity style={ds.btnDanger} onPress={logout}>
                <Text style={ds.btnDangerText}>Keluar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[ds.btnSmall, (!request || authLoading) && { opacity: 0.5 }]}
              onPress={() => { setAuthLoading(true); promptAsync(); }}
              disabled={!request || authLoading}
            >
              {authLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={ds.btnSmallText}>Login Google</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* UNIT USAHA */}
      <View style={ds.card}>
        <Text style={ds.cardTitle}>Unit Usaha</Text>
        <View style={{ height: 10 }} />
        <Text style={ds.label}>Kode Unit</Text>
        <View style={ds.inputRow}>
          <TextInput
            style={[ds.input, { flex: 1 }]}
            placeholder="Contoh: DMI"
            placeholderTextColor={C.textMuted}
            value={unitInput}
            onChangeText={setUnitInput}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={ds.btnSmall} onPress={saveUnit}>
            <Text style={ds.btnSmallText}>{unitSaved ? 'Update' : 'Simpan'}</Text>
          </TouchableOpacity>
        </View>
        {unitSaved && (
          <View style={[ds.badge('accent'), { marginTop: 8, alignSelf: 'flex-start' }]}>
            <Text style={ds.badgeText('accent')}>{unitUsaha}</Text>
          </View>
        )}
      </View>

      {/* NOMOR BPK */}
      <View style={ds.card}>
        <View style={ds.cardRow}>
          <Text style={ds.cardTitle}>Nomor BPK</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[ds.cardSub, { fontSize: 12 }]}>Otomatis</Text>
            <Switch
              value={isAutoNoBpk}
              onValueChange={setIsAutoNoBpk}
              trackColor={{ false: C.border, true: C.accent }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>
        </View>

        {isAutoNoBpk ? (
          <>
            <Text style={ds.label}>No. Urut (4 digit)</Text>
            <TextInput
              style={ds.input}
              placeholder="0001"
              placeholderTextColor={C.textMuted}
              value={noBpkUrut}
              keyboardType="numeric"
              maxLength={4}
              onChangeText={t => setNoBpkUrut(t.replace(/[^0-9]/g, ''))}
            />
            <View style={ds.previewBox}>
              <Text style={ds.previewLabel}>Preview</Text>
              <Text style={ds.previewValue}>{getAutoBpk()}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={ds.label}>Nomor Manual</Text>
            <TextInput
              style={ds.input}
              placeholder="0001/DMI/V/2026"
              placeholderTextColor={C.textMuted}
              value={noBpkManual}
              onChangeText={setNoBpkManual}
            />
          </>
        )}
      </View>

      {/* FOTO */}
      <View style={ds.card}>
        <View style={ds.cardRow}>
          <Text style={ds.cardTitle}>Foto Lampiran</Text>
          <View style={[ds.badge('accent'), { paddingHorizontal: 8 }]}>
            <Text style={ds.badgeText('accent')}>{photos.length} foto</Text>
          </View>
        </View>

        <View style={ds.row2}>
          <TouchableOpacity style={[ds.btnOutline, ds.flex1]} onPress={takePhoto}>
            <Text style={ds.btnOutlineText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ds.btnOutline, ds.flex1]} onPress={pickGallery}>
            <Text style={ds.btnOutlineText}>Galeri</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {photos.map((uri, i) => (
              <View key={i} style={ds.thumbWrap}>
                <Image source={{ uri }} style={ds.thumb} />
                <TouchableOpacity style={ds.removeBtn}
                  onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
                <View style={ds.thumbIdx}>
                  <Text style={ds.thumbIdxText}>{i + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* INFO FILE */}
      <View style={ds.infoBar}>
        <View style={{ flex: 1 }}>
          <Text style={ds.infoBarLabel}>File akan diupload sebagai</Text>
          <Text style={ds.infoBarValue} numberOfLines={1}>{getNoBpk()}.pdf</Text>
        </View>
      </View>

      {/* ACTIONS */}
      <View style={[ds.row2, { marginTop: 12 }]}>
        <TouchableOpacity style={[ds.btnOutline, ds.flex1]} onPress={previewPdf} disabled={uploading}>
          <Text style={ds.btnOutlineText}>Preview PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ds.btnPrimary, ds.flex1, uploading && { opacity: 0.6 }]}
          onPress={uploadToDrive}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={ds.btnPrimaryText}>Upload Drive</Text>
          }
        </TouchableOpacity>
      </View>

    </ScrollView>
  );

  // ─── SETTINGS TAB ─────────────────────────────────────────────────────────
  const renderSettings = () => (
    <ScrollView style={ds.scroll} contentContainerStyle={ds.content} showsVerticalScrollIndicator={false}>

      {/* TAMPILAN */}
      <View style={ds.card}>
        <Text style={[ds.cardTitle, { marginBottom: 14 }]}>Tampilan</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 14, color: C.text, fontWeight: '500' }}>Mode Gelap</Text>
            <Text style={ds.cardSub}>Ubah tema aplikasi</Text>
          </View>
          <DarkToggle dark={dark} onToggle={toggleDark} />
        </View>
      </View>

      {/* FOLDER DRIVE */}
      <View style={ds.card}>
        <View style={ds.cardRow}>
          <View>
            <Text style={ds.cardTitle}>Google Drive Folder</Text>
            <Text style={ds.cardSub}>Tujuan upload dokumen</Text>
          </View>
          {folderSaved && (
            <View style={ds.badge('success')}>
              <Text style={ds.badgeText('success')}>✓ Tersimpan</Text>
            </View>
          )}
        </View>

        <Text style={ds.label}>Folder ID</Text>
        <Text style={[ds.cardSub, { marginBottom: 8 }]}>
          Dari URL: drive.google.com/drive/folders/<Text style={{ color: C.accent }}>ID_INI</Text>
        </Text>
        <View style={ds.inputRow}>
          <TextInput
            style={[ds.input, { flex: 1 }]}
            placeholder="Paste Folder ID di sini"
            placeholderTextColor={C.textMuted}
            value={folderInput}
            onChangeText={setFolderInput}
            autoCapitalize="none"
          />
          <TouchableOpacity style={ds.btnSmall} onPress={saveFolder}>
            <Text style={ds.btnSmallText}>{folderSaved ? 'Update' : 'Simpan'}</Text>
          </TouchableOpacity>
        </View>
        {folderSaved && folderId && (
          <Text style={[ds.cardSub, { marginTop: 6 }]} numberOfLines={1}>
            ID: {folderId}
          </Text>
        )}
      </View>

      {/* INFO AKUN */}
      <View style={ds.card}>
        <Text style={[ds.cardTitle, { marginBottom: 14 }]}>Status Akun</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 14, color: C.text, fontWeight: '500' }}>Google Drive</Text>
            <Text style={ds.cardSub}>{isLoggedIn ? 'Akun terhubung' : 'Belum login'}</Text>
          </View>
          {isLoggedIn ? (
            <TouchableOpacity style={ds.btnDanger} onPress={logout}>
              <Text style={ds.btnDangerText}>Logout</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[ds.btnSmall, (!request || authLoading) && { opacity: 0.5 }]}
              onPress={() => { setAuthLoading(true); promptAsync(); }}
              disabled={!request || authLoading}
            >
              {authLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={ds.btnSmallText}>Login</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* APP INFO */}
      <View style={[ds.card, { alignItems: 'center', paddingVertical: 20 }]}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>BPK Scanner</Text>
        <Text style={[ds.cardSub, { marginTop: 2 }]}>v1.0.0 · Bukti Pengeluaran Kas</Text>
      </View>

    </ScrollView>
  );

  return (
    <SafeAreaView style={ds.safe}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* HEADER */}
      <View style={ds.header}>
        <View>
          <Text style={ds.headerTitle}>BPK Scanner</Text>
          <Text style={ds.headerSub}>{formatDate(currentTime)}</Text>
        </View>
        <View style={ds.headerRight}>
          <Text style={ds.clock}>{formatTime(currentTime)}</Text>
        </View>
      </View>

      {/* TAB BAR */}
      <View style={ds.tabBar}>
        <TouchableOpacity style={ds.tabBtn(tab === 'home')} onPress={() => setTab('home')}>
          <Text style={ds.tabLabel(tab === 'home')}>Dokumen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ds.tabBtn(tab === 'settings')} onPress={() => setTab('settings')}>
          <Text style={ds.tabLabel(tab === 'settings')}>Pengaturan</Text>
        </TouchableOpacity>
      </View>

      {tab === 'home' ? renderHome() : renderSettings()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toggleTrack: {
    width: 46, height: 26, borderRadius: 13,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
});
