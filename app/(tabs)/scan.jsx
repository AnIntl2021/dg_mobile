import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { cardsApi, API_BASE_URL, FRONTEND_BASE_URL } from '@/services/api';

const BRAND = '#1b4654';

/* ─── Parse tenantSlug + cardSlug from a DigCard URL ─── */
function parseDigCardUrl(url) {
  // Matches: https://digicards.ansoftt.com/#/card/{tenant}/{slug}
  const hashMatch = url.match(/\/#\/card\/([^/]+)\/([^/?#]+)/);
  if (hashMatch) return { tenantSlug: hashMatch[1], cardSlug: hashMatch[2] };
  // Matches: .../c/{tenant}/{slug}
  const pathMatch = url.match(/\/c\/([^/]+)\/([^/?#]+)/);
  if (pathMatch) return { tenantSlug: pathMatch[1], cardSlug: pathMatch[2] };
  return null;
}

/* ─── Resolve image URL to absolute ─── */
function resolveImageUrl(val) {
  if (!val) return null;
  if (val.startsWith('data:') || val.startsWith('http')) return val;
  return `${API_BASE_URL.replace(/\/api$/, '')}${val}`;
}

function parseDesign(card) {
  try {
    return typeof card?.design === 'string' ? JSON.parse(card.design) : (card?.design || {});
  } catch {
    return {};
  }
}

function buildShareMessage(card, publicUrl) {
  const design = parseDesign(card);
  const lines = [card?.name || 'DigCard'];
  const jobTitle = design.jobTitle || design.title || card?.title || '';

  if (jobTitle) lines.push(jobTitle);
  if (card?.company) lines.push(card.company);
  if (card?.phone) lines.push(`Phone: ${card.phone}`);
  if (card?.email) lines.push(`Email: ${card.email}`);
  if (card?.website) lines.push(`Website: ${card.website}`);
  lines.push('');
  lines.push(publicUrl);

  return lines.join('\n');
}

/* ─── Scanned card detail modal ─── */
function ScannedCardModal({ card, tenantSlug, cardSlug, publicUrl, onClose }) {
  if (!card) return null;

  const design = parseDesign(card);
  const accentColor = design.accentColor || BRAND;
  const cardBgColor = design.bgColor || '#ffffff';
  const cardTextColor = design.textColor || '#111827';
  const templateId = design.selectedTemplateId || design.cardStyle || '';
  const isDark = !['#ffffff', '#f8fafc', '#fff', 'white'].includes((cardBgColor || '').toLowerCase());
  const rowBorderColor = isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9';
  const subTextColor = isDark ? 'rgba(255,255,255,0.6)' : '#64748B';
  const avatarUrl = resolveImageUrl(card.profile_image);
  const coverUrl = resolveImageUrl(design.coverImage);
  const companyLogoUrl = resolveImageUrl(design.companyLogoImage);
  const jobTitle = design.jobTitle || design.title || card.title || '';
  const socialLinks = (() => {
    try {
      const s = typeof card.social_links === 'string' ? JSON.parse(card.social_links) : (card.social_links || []);
      return Array.isArray(s) ? s.filter((link) => link?.url) : [];
    } catch {
      return [];
    }
  })();
  const publicCardUrl = publicUrl || `${FRONTEND_BASE_URL}/#/card/${tenantSlug}/${cardSlug}`;
  const vCardUrl = `${API_BASE_URL}/public/card/vcard/${tenantSlug}/${cardSlug}`;
  const shareMessage = buildShareMessage(card, publicCardUrl);

  const openLink = (url) => {
    if (!url) return;
    const href = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(href).catch(() => {});
  };

  const openAddress = () => {
    if (!card.address) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`).catch(() => {});
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareMessage, url: publicCardUrl });
    } catch {}
  };

  const saveContact = () => {
    Linking.openURL(vCardUrl).catch(() => {
      Alert.alert('Error', 'Could not save contact right now.');
    });
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={cm.safe}>
        <View style={[cm.header, { backgroundColor: accentColor }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={cm.headerTitle}>Scanned Card</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={cm.scroll} showsVerticalScrollIndicator={false}>
          <View style={[cm.previewCard, { backgroundColor: cardBgColor }]}> 
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={cm.previewHeaderImage} />
            ) : templateId === 'minimal-pro' ? (
              <View style={[cm.previewHeader, { backgroundColor: cardBgColor }]}>
                <View style={[cm.bubbleLargeLeft, { backgroundColor: '#e8503a' }]} />
                <View style={[cm.bubbleMediumRight, { backgroundColor: accentColor }]} />
              </View>
            ) : templateId === 'ocean-gradient' ? (
              <View style={[cm.previewHeader, { backgroundColor: cardBgColor }]}>
                <View style={[cm.bubbleLargeRight, { backgroundColor: accentColor }]} />
                <View style={[cm.bubbleSmallRight, { backgroundColor: '#2abfaa' }]} />
              </View>
            ) : (
              <View style={[cm.previewHeader, { backgroundColor: accentColor }]}>
                <View style={cm.defaultBubbleTop} />
                <View style={cm.defaultBubbleBottom} />
              </View>
            )}

            <View style={cm.previewAvatarRow}>
              <View style={cm.logoWrap}>
                {companyLogoUrl ? (
                  <Image source={{ uri: companyLogoUrl }} style={cm.logoImg} resizeMode="contain" />
                ) : card.company ? (
                  <View style={[cm.logoFallback, { backgroundColor: accentColor }]}>
                    <Ionicons name="business-outline" size={20} color="#fff" />
                    <Text style={cm.logoFallbackText} numberOfLines={1}>{card.company.substring(0, 10)}</Text>
                  </View>
                ) : (
                  <View style={[cm.logoFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }]}>
                    <Ionicons name="business-outline" size={22} color={isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8'} />
                  </View>
                )}
              </View>

              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={cm.avatar} />
              ) : (
                <View style={[cm.avatarFallback, { backgroundColor: accentColor }]}>
                  <Text style={cm.avatarInitial}>{(card.name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>

            <View style={cm.infoSection}>
              {card.company ? (
                <View style={{ marginBottom: 6 }}>
                  <Text style={cm.companyLabel}>COMPANY</Text>
                  <Text style={[cm.companyAccent, { color: accentColor }]}>{card.company}</Text>
                </View>
              ) : null}
              <Text style={[cm.name, { color: cardTextColor }]}>{card.name || ''}</Text>
              {jobTitle ? <Text style={[cm.jobTitle, { color: cardTextColor, opacity: 0.7 }]}>{jobTitle}</Text> : null}
              {card.department ? <Text style={[cm.department, { color: subTextColor }]}>{card.department}</Text> : null}
            </View>

            {(card.bio || card.headline) ? (
              <View style={cm.bioCard}>
                <Text style={cm.bioLabel}>About</Text>
                <Text style={[cm.bioText, { color: subTextColor }]}>{card.bio || card.headline}</Text>
              </View>
            ) : null}

            <View style={cm.detailsCard}>
              {card.phone ? (
                <TouchableOpacity style={[cm.row, { borderBottomColor: rowBorderColor }]} onPress={() => Linking.openURL(`tel:${card.phone}`)}>
                  <View style={[cm.rowIcon, { backgroundColor: accentColor }]}><Ionicons name="call-outline" size={16} color="#fff" /></View>
                  <View style={cm.rowText}><Text style={[cm.rowValue, { color: cardTextColor }]}>{card.phone}</Text><Text style={[cm.rowLabel, { color: subTextColor }]}>Phone</Text></View>
                  <Ionicons name="chevron-forward" size={14} color="#CCC" />
                </TouchableOpacity>
              ) : null}
              {card.email ? (
                <TouchableOpacity style={[cm.row, { borderBottomColor: rowBorderColor }]} onPress={() => Linking.openURL(`mailto:${card.email}`)}>
                  <View style={[cm.rowIcon, { backgroundColor: accentColor }]}><Ionicons name="mail-outline" size={16} color="#fff" /></View>
                  <View style={cm.rowText}><Text style={[cm.rowValue, { color: cardTextColor }]}>{card.email}</Text><Text style={[cm.rowLabel, { color: subTextColor }]}>Email</Text></View>
                  <Ionicons name="chevron-forward" size={14} color="#CCC" />
                </TouchableOpacity>
              ) : null}
              {card.website ? (
                <TouchableOpacity style={[cm.row, { borderBottomColor: rowBorderColor }]} onPress={() => openLink(card.website)}>
                  <View style={[cm.rowIcon, { backgroundColor: accentColor }]}><Ionicons name="globe-outline" size={16} color="#fff" /></View>
                  <View style={cm.rowText}><Text style={[cm.rowValue, { color: cardTextColor }]}>{card.website}</Text><Text style={[cm.rowLabel, { color: subTextColor }]}>Website</Text></View>
                  <Ionicons name="chevron-forward" size={14} color="#CCC" />
                </TouchableOpacity>
              ) : null}
              {card.address ? (
                <TouchableOpacity style={[cm.row, { borderBottomColor: rowBorderColor }]} onPress={openAddress}>
                  <View style={[cm.rowIcon, { backgroundColor: accentColor }]}><Ionicons name="location-outline" size={16} color="#fff" /></View>
                  <View style={cm.rowText}><Text style={[cm.rowValue, { color: cardTextColor }]}>{card.address}</Text><Text style={[cm.rowLabel, { color: subTextColor }]}>Address</Text></View>
                  <Ionicons name="chevron-forward" size={14} color="#CCC" />
                </TouchableOpacity>
              ) : null}
            </View>

            {socialLinks.length > 0 ? (
              <View style={cm.detailsCard}>
                {socialLinks.map((link, index) => (
                  <TouchableOpacity key={`${link.platform}-${index}`} style={[cm.row, { borderBottomColor: rowBorderColor }]} onPress={() => openLink(link.url)}>
                    <View style={[cm.rowIcon, { backgroundColor: accentColor }]}><Ionicons name="link-outline" size={16} color="#fff" /></View>
                    <View style={cm.rowText}>
                      <Text style={[cm.rowValue, { color: cardTextColor }]}>{link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}</Text>
                      <Text style={[cm.rowLabel, { color: subTextColor }]} numberOfLines={1}>{link.url}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#CCC" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <View style={cm.actionsRow}>
            <TouchableOpacity style={[cm.actionBtn, { backgroundColor: accentColor }]} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={cm.actionLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.actionBtn, { backgroundColor: accentColor }]} onPress={saveContact}>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={cm.actionLabel}>Save</Text>
            </TouchableOpacity>
            {card.website ? (
              <TouchableOpacity style={[cm.actionBtn, { backgroundColor: accentColor }]} onPress={() => openLink(card.website)}>
                <Ionicons name="globe" size={20} color="#fff" />
                <Text style={cm.actionLabel}>Visit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ScanScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [scannedCard, setScannedCard] = useState(null);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    // Check if it's a DigCard URL
    const parsed = parseDigCardUrl(data);
    if (parsed) {
      setLoadingCard(true);
      try {
        const { data: card } = await cardsApi.getPublicCard(parsed.tenantSlug, parsed.cardSlug);
        setScannedCard({ card, tenantSlug: parsed.tenantSlug, cardSlug: parsed.cardSlug, publicUrl: data });
      } catch {
        // Card fetch failed — fall back to opening in browser
        Alert.alert(
          'Card Scanned',
          'Open this card in your browser?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
            { text: 'Open', onPress: () => { Linking.openURL(data); setScanned(false); } },
          ]
        );
      } finally {
        setLoadingCard(false);
      }
      return;
    }

    // Non-DigCard URL
    const isUrl = data.startsWith('http://') || data.startsWith('https://');
    Alert.alert(
      'QR Code Scanned',
      isUrl ? 'Open this link?' : data,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
        isUrl
          ? { text: 'Open', onPress: () => { Linking.openURL(data); setScanned(false); } }
          : { text: 'OK', onPress: () => setScanned(false) },
      ]
    );
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={56} color={BRAND} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>Allow camera access to scan QR codes from digital business cards.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* In-app card detail modal */}
      {scannedCard ? (
        <ScannedCardModal
          card={scannedCard.card}
          tenantSlug={scannedCard.tenantSlug}
          cardSlug={scannedCard.cardSlug}
          publicUrl={scannedCard.publicUrl}
          onClose={() => { setScannedCard(null); setScanned(false); }}
        />
      ) : null}

      {/* Full-screen loading overlay */}
      {loadingCard ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading card…</Text>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setTorch((v) => !v)} style={styles.torchBtn}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={torch ? '#FFD700' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.torchBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Dark overlay with scan frame cutout */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>
      </View>

      {/* Bottom hint */}
      <View style={styles.bottom}>
        <Text style={styles.hint}>Point camera at a DigCard QR code</Text>
        {scanned && !scannedCard && !loadingCard && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => setScanned(false)}>
            <Text style={styles.retryText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const FRAME = 240;
const CORNER = 22;
const THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#000',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  torchBtn: { padding: 6 },
  cameraContainer: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: FRAME },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanFrame: { width: FRAME, height: FRAME, backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: BRAND },
  cornerTL: { top: 0, left: 0, borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: THICKNESS, borderRightWidth: THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS },
  bottom: { backgroundColor: '#000', paddingVertical: 24, alignItems: 'center', gap: 12 },
  hint: { color: '#AAAAAA', fontSize: 14 },
  retryBtn: { backgroundColor: BRAND, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    gap: 14,
  },
  loadingText: { color: '#fff', fontSize: 15 },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#fff', gap: 14 },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  permSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  permBtn: { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

/* ─── Scanned card modal styles ─── */
const cm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scroll: { padding: 14, paddingBottom: 40 },
  previewCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 14 },
  previewHeader: { height: 112, position: 'relative', overflow: 'hidden' },
  previewHeaderImage: { width: '100%', height: 112 },
  bubbleLargeLeft: { position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: 40 },
  bubbleMediumRight: { position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: 32.5 },
  bubbleLargeRight: { position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40 },
  bubbleSmallRight: { position: 'absolute', top: 2, right: 22, width: 48, height: 48, borderRadius: 24 },
  defaultBubbleTop: { position: 'absolute', top: -10, right: -10, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)' },
  defaultBubbleBottom: { position: 'absolute', bottom: -8, left: -8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  previewAvatarRow: { marginTop: -40, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  logoWrap: { width: 76, height: 76, borderRadius: 18, borderWidth: 4, borderColor: '#fff', backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: '100%', height: '100%' },
  logoFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  logoFallbackText: { color: '#fff', fontSize: 9, fontWeight: '700', marginTop: 2 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', backgroundColor: '#fff' },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  infoSection: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  companyLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
  companyAccent: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  name: { fontSize: 22, fontWeight: '800' },
  jobTitle: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  department: { fontSize: 12, marginTop: 4 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 8 },
  actionBtn: { alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, minWidth: 72 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  detailsCard: { marginHorizontal: 14, marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowText: { flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  bioCard: { marginHorizontal: 14, marginBottom: 10, borderRadius: 14, paddingHorizontal: 4 },
  bioLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 21 },
});

