import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, Switch, ActivityIndicator,
  SafeAreaView, Platform,
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

// =============================================
// GANTI DENGAN CLIENT ID KAMU
const ANDROID_CLIENT_ID = 'ANDROID_CLIENT_ID_KAMU.apps.googleusercontent.com';
const WEB_CLIENT_ID    = 'WEB_CLIENT_ID_KAMU.apps.googleusercontent.com';
// =============================================

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const KEY_UNIT    = '@bpk_unit_usaha';
const KEY_FOLDER  = '@bpk_folder_id';
const KEY_ACCESS  = '@bpk_access_token';
const KEY_REFRESH = '@bpk_refresh_token';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
  revocationEndpoint:    'https://oauth2.googleapis.com/revoke',
};

export default function App() {
  const [currentTime, setCurrentTime]   = useState(new Date());
  const [unitUsaha, setUnitUsaha]       = useState('');
  const [unitInput, setUnitInput]       = useState('');
  const [unitSaved, setUnitSaved]       = useState(false);
  const [noBpkUrut, setNoBpkUrut]       = useState('');
  const [isAutoNoBpk, setIsAutoNoBpk]   = useState(true);
  const [noBpkManual, setNoBpkManual]   = useState('');
  const [photos, setPhotos]             = useState<string[]>([]);
  const [folderId, setFolderId]         = useState('');
  const [folderInput, setFolderInput]   = useState('');
  const [folderSaved, setFolderSaved]   = useState(false);
  const [accessToken, setAccessToken]   = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [authLoading, setAuthLoading]   = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'com.bpkscanner' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:             ANDROID_CLIENT_ID,
      redirectUri,
      scopes:               ['https://www.googleapis.com/auth/drive.file', 'openid', 'profile', 'email'],
      responseType:         AuthSession.ResponseType.Code,
      accessType:           'offline',
      prompt:               AuthSession.Prompt.Consent,
    },
    discovery
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadSaved();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCode(code);
    }
  }, [response]);

  const loadSaved = async () => {
    try {
      const unit    = await AsyncStorage.getItem(KEY_UNIT);
      const folder  = await AsyncStorage.getItem(KEY_FOLDER);
      const access  = await AsyncStorage.getItem(KEY_ACCESS);
      const refresh = await AsyncStorage.getItem(KEY_REFRESH);
      if (unit)    { setUnitUsaha(unit); setUnitInput(unit); setUnitSaved(true); }
      if (folder)  { setFolderId(folder); setFolderInput(folder); setFolderSaved(true); }
      if (access)  { setAccessToken(access); }
      if (refresh) { setRefreshToken(refresh); setIsLoggedIn(true); }
    } catch (e) {}
  };

  const exchangeCode = async (code: string) => {
    setAuthLoading(true);
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     WEB_CLIENT_ID,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
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
        Alert.alert('Login Berhasil! ✅', 'Akun Google berhasil terhubung');
      } else {
        Alert.alert('Login Gagal', data.error_description || 'Coba lagi');
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
          client_id:     WEB_CLIENT_ID,
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
    Alert.alert('Logout', 'Akun Google berhasil diputus');
  };

  const formatDate = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const formatTime = (d: Date) =>
    [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');

  const getAutoBpk = () => {
    const now = new Date();
    return `${(noBpkUrut || '0').padStart(4, '0')}/${unitUsaha || 'UNIT'}/${ROMAN_MONTHS[now.getMonth()]}/${now.getFullYear()}`;
  };

  const getNoBpk = () => isAutoNoBpk ? getAutoBpk() : (noBpkManual || '(belum diisi)');

  const saveUnit = async () => {
    if (!unitInput.trim()) return Alert.alert('Error', 'Nama Unit Usaha tidak boleh kosong');
    const val = unitInput.trim().toUpperCase();
    await AsyncStorage.setItem(KEY_UNIT, val);
    setUnitUsaha(val); setUnitSaved(true);
    Alert.alert('Tersimpan', `Unit Usaha: ${val}`);
  };

  const saveFolder = async () => {
    if (!folderInput.trim()) return Alert.alert('Error', 'Folder ID tidak boleh kosong');
    await AsyncStorage.setItem(KEY_FOLDER, folderInput.trim());
    setFolderId(folderInput.trim()); setFolderSaved(true);
    Alert.alert('Tersimpan', 'Folder Drive ID berhasil disimpan');
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission', 'Izin kamera diperlukan');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled) setPhotos(p => [...p, result.assets[0].uri]);
  };

  const pickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission', 'Izin galeri diperlukan');
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) setPhotos(p => [...p, ...result.assets.map((a: any) => a.uri)]);
  };

  const buildPdf = async (): Promise<string> => {
    const noBpk = getNoBpk();
    const imgs = await Promise.all(photos.map(async (uri, i) => {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      return `<div style="page-break-inside:avoid;margin-bottom:16px;">
        <p style="font-size:11px;color:#666;margin:0 0 4px;">Lampiran ${i + 1}</p>
        <img src="data:image/jpeg;base64,${b64}" style="width:100%;max-height:700px;object-fit:contain;"/>
      </div>`;
    }));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>body{font-family:Arial,sans-serif;margin:24px;color:#222;}
    h2{font-size:16px;}hr{border:none;border-top:1px solid #ddd;margin:16px 0;}
    .lbl{font-size:11px;color:#888;margin-bottom:2px;}
    .val{font-size:14px;font-weight:bold;margin-bottom:12px;}</style></head><body>
    <h2>Bukti Pengeluaran Kas (BPK)</h2>
    <p style="font-size:12px;color:#555;">Dicetak: ${formatDate(new Date())} ${formatTime(new Date())}</p>
    <hr/>
    <div class="lbl">Nomor BPK</div><div class="val">${noBpk}</div>
    <div class="lbl">Unit Usaha</div><div class="val">${unitUsaha || '-'}</div>
    <hr/>
    <div class="lbl" style="margin-bottom:12px;">Lampiran (${photos.length} foto)</div>
    ${imgs.join('')}</body></html>`;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
  };

  const uploadToDrive = async () => {
    if (photos.length === 0) return Alert.alert('Error', 'Belum ada foto lampiran');
    if (!folderId) return Alert.alert('Error', 'Folder Drive ID belum diisi');
    if (!isLoggedIn) return Alert.alert('Error', 'Login Google dulu');
    setUploading(true);
    try {
      let token = await getValidToken();
      if (!token) {
        token = await refreshAccessToken();
        if (!token) return Alert.alert('Error', 'Sesi expired, login ulang');
      }
      const pdfUri  = await buildPdf();
      const noBpk   = getNoBpk();
      const fileName = noBpk.replace(/\//g, '_') + '.pdf';
      const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/pdf' });
      const boundary = 'bpk_boundary';
      const pdfB64   = await FileSystem.readAsStringAsync(pdfUri, { encoding: 'base64' as any });
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
        Alert.alert('Upload Berhasil! ✅', `File: ${fileName}\nDrive ID: ${result.id}`);
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

  const previewPdf = async () => {
    if (photos.length === 0) return Alert.alert('Error', 'Belum ada foto');
    setUploading(true);
    try {
      const uri = await buildPdf();
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.headerTitle}>BPK Scanner</Text>
        <View style={s.headerRight}>
          <Text style={s.headerDate}>{formatDate(currentTime)}</Text>
          <Text style={s.headerTime}>{formatTime(currentTime)}</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* LOGIN GOOGLE */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔐 Akun Google Drive</Text>
          {isLoggedIn ? (
            <View style={s.loginRow}>
              <View style={s.loginBadge}>
                <Text style={s.loginBadgeText}>✅ Terhubung</Text>
              </View>
              <TouchableOpacity style={s.btnLogout} onPress={logout}>
                <Text style={s.btnLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.btnGoogle, (!request || authLoading) && s.btnDisabled]}
              onPress={() => { setAuthLoading(true); promptAsync(); }}
              disabled={!request || authLoading}
            >
              {authLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnGoogleText}>🔑 Login dengan Google</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* UNIT USAHA */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🏢 Unit Usaha</Text>
          {unitSaved && <Text style={s.badge}>Tersimpan: {unitUsaha}</Text>}
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Contoh: DMI"
              placeholderTextColor="#aaa" value={unitInput}
              onChangeText={setUnitInput} autoCapitalize="characters" />
            <TouchableOpacity style={s.btnSave} onPress={saveUnit}>
              <Text style={s.btnSaveText}>{unitSaved ? 'Update' : 'Simpan'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* NOMOR BPK */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📄 Nomor BPK</Text>
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Mode Otomatis</Text>
            <Switch value={isAutoNoBpk} onValueChange={setIsAutoNoBpk}
              trackColor={{ false: '#ccc', true: '#1a73e8' }} thumbColor="#fff" />
          </View>
          {isAutoNoBpk ? (
            <>
              <Text style={s.subLabel}>No. Urut (4 digit)</Text>
              <TextInput style={s.input} placeholder="0000" placeholderTextColor="#aaa"
                value={noBpkUrut} keyboardType="numeric" maxLength={4}
                onChangeText={t => setNoBpkUrut(t.replace(/[^0-9]/g, ''))} />
              <View style={s.previewBox}>
                <Text style={s.previewLabel}>Preview No. BPK:</Text>
                <Text style={s.previewValue}>{getAutoBpk()}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={s.subLabel}>Isi No. BPK Manual</Text>
              <TextInput style={s.input} placeholder="0001/DMI/V/2026"
                placeholderTextColor="#aaa" value={noBpkManual} onChangeText={setNoBpkManual} />
            </>
          )}
        </View>

        {/* FOTO */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📷 Foto Lampiran ({photos.length} foto)</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btnPhoto, { marginRight: 8 }]} onPress={takePhoto}>
              <Text style={s.btnPhotoText}>📸 Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPhoto} onPress={pickGallery}>
              <Text style={s.btnPhotoText}>🖼 Galeri</Text>
            </TouchableOpacity>
          </View>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {photos.map((uri, i) => (
                <View key={i} style={s.thumbWrap}>
                  <Image source={{ uri }} style={s.thumb} />
                  <TouchableOpacity style={s.removeBtn}
                    onPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
                    <Text style={s.removeTxt}>✕</Text>
                  </TouchableOpacity>
                  <Text style={s.thumbIdx}>{i + 1}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* FOLDER DRIVE */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📁 Google Drive Folder ID</Text>
          {folderSaved && <Text style={s.badge}>Tersimpan ✓</Text>}
          <Text style={s.subLabel}>Dari URL: drive.google.com/drive/folders/&lt;ID&gt;</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Paste Folder ID"
              placeholderTextColor="#aaa" value={folderInput}
              onChangeText={setFolderInput} autoCapitalize="none" />
            <TouchableOpacity style={s.btnSave} onPress={saveFolder}>
              <Text style={s.btnSaveText}>{folderSaved ? 'Update' : 'Simpan'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACTIONS */}
        <View style={s.row}>
          <TouchableOpacity style={[s.btnPreview, { marginRight: 8 }]}
            onPress={previewPdf} disabled={uploading}>
            <Text style={s.btnPreviewText}>👁 Preview PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnUpload, uploading && s.btnDisabled]}
            onPress={uploadToDrive} disabled={uploading}>
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnUploadText}>☁️ Upload Drive</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoLabel}>File akan diupload sebagai:</Text>
          <Text style={s.infoValue}>{getNoBpk().replace(/\//g, '_')}.pdf</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: Platform.OS === 'android' ? 40 : 8,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { color: '#ddeeff', fontSize: 13 },
  headerTime: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 10 },
  badge: {
    fontSize: 12, color: '#1a73e8', backgroundColor: '#e8f0fe',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: '#fafafa', marginBottom: 4,
  },
  btnSave: { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toggleLabel: { fontSize: 14, color: '#444' },
  subLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  previewBox: { backgroundColor: '#f0f7ff', borderRadius: 8, padding: 10, marginTop: 6 },
  previewLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  previewValue: { fontSize: 16, fontWeight: '700', color: '#1a73e8' },
  btnPhoto: {
    flex: 1, borderWidth: 1.5, borderColor: '#1a73e8',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  btnPhotoText: { color: '#1a73e8', fontWeight: '600', fontSize: 14 },
  thumbWrap: { marginRight: 10, position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#e53935', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  removeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  thumbIdx: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
    fontSize: 10, paddingHorizontal: 4, borderRadius: 4,
  },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loginBadge: { backgroundColor: '#e6f4ea', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  loginBadgeText: { color: '#137333', fontWeight: '600', fontSize: 14 },
  btnLogout: { borderWidth: 1, borderColor: '#e53935', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnLogoutText: { color: '#e53935', fontWeight: '600', fontSize: 13 },
  btnGoogle: { backgroundColor: '#1a73e8', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnGoogleText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnPreview: {
    flex: 1, borderWidth: 1.5, borderColor: '#1a73e8',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  btnPreviewText: { color: '#1a73e8', fontWeight: '700', fontSize: 15 },
  btnUpload: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#aaa', borderColor: '#aaa' },
  btnUploadText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  infoBox: {
    backgroundColor: '#fff8e1', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#f9a825', marginTop: 10,
  },
  infoLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#333' },
});
