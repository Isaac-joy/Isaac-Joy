import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../lib/api";
import { colors, fonts, gradients } from "../theme";
import GradientBackground from "../components/GradientBackground";
import GlowCard from "../components/GlowCard";
import NeonButton from "../components/NeonButton";
import CareerCard from "../components/CareerCard";
import FadeIn from "../components/FadeIn";

function watchOnYouTube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  Linking.openURL(url).catch(() => {});
}

// ── Chapter card ─────────────────────────────────────────────────────────────
function ChapterCard({ book, chapter, onComplete }) {
  const done = chapter.status === "completed";
  const [notes, setNotes] = useState(chapter.notes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  async function toggleNotes() {
    if (showNotes) {
      setShowNotes(false);
      return;
    }
    if (notes) {
      setShowNotes(true);
      return;
    }
    setLoadingNotes(true);
    try {
      const r = await api.getChapterNotes(book.id, chapter.id);
      setNotes(r.notes || "");
      setShowNotes(true);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setLoadingNotes(false);
    }
  }

  const concepts = Array.isArray(chapter.key_concepts) ? chapter.key_concepts : [];

  return (
    <View style={[styles.chCard, done && { opacity: 0.65 }]}>
      <View style={styles.chHead}>
        <Pressable onPress={() => !done && onComplete(chapter)} hitSlop={8}>
          {done ? (
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
          ) : (
            <Ionicons name="ellipse-outline" size={26} color={colors.accent} />
          )}
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.chOrdinal}>UNIT {String(chapter.ordinal).padStart(2, "0")}</Text>
          <Text style={[styles.chTitle, done && styles.strike]}>{chapter.title}</Text>
        </View>
        <Text style={styles.chXp}>+{chapter.xp_reward ?? 40}</Text>
      </View>

      {chapter.objective ? <Text style={styles.chObjective}>{chapter.objective}</Text> : null}

      {concepts.length > 0 ? (
        <View style={styles.conceptRow}>
          {concepts.map((c, i) => (
            <View key={i} style={styles.concept}>
              <Text style={styles.conceptTxt}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.chActions}>
        {chapter.youtube_query ? (
          <Pressable style={styles.chBtn} onPress={() => watchOnYouTube(chapter.youtube_query)}>
            <Ionicons name="logo-youtube" size={14} color={colors.danger} />
            <Text style={styles.chBtnTxt}>WATCH</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.chBtn} onPress={toggleNotes} disabled={loadingNotes}>
          <Ionicons name="sparkles" size={14} color={colors.violet} />
          <Text style={styles.chBtnTxt}>
            {loadingNotes ? "FORGING NOTES…" : showNotes ? "HIDE NOTES" : "SYSTEM NOTES"}
          </Text>
        </Pressable>
      </View>

      {showNotes && notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesTxt}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function AcademyScreen() {
  const [mode, setMode] = useState("books"); // books | career

  const [bookList, setBookList] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chLoading, setChLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [career, setCareer] = useState([]);
  const [careerLoaded, setCareerLoaded] = useState(false);
  const [careerBusy, setCareerBusy] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", level: "" });
  const [enrolling, setEnrolling] = useState(false);

  const burstY = useRef(new Animated.Value(0)).current;
  const burstO = useRef(new Animated.Value(0)).current;
  const [burstText, setBurstText] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await api.getBooks();
      setBookList(Array.isArray(rows) ? rows : []);
    } catch (_) {
      // keep prior data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function loadCareer(force) {
    if (careerLoaded && !force) return;
    try {
      const rows = await api.getCareer();
      setCareer(Array.isArray(rows) ? rows : []);
      setCareerLoaded(true);
    } catch (_) {
      // keep prior
    }
  }

  function switchMode(m) {
    setMode(m);
    if (m === "career") loadCareer(false);
  }

  function fireBurst(xp) {
    setBurstText(`+${xp} INT`);
    burstY.setValue(0);
    burstO.setValue(1);
    Animated.parallel([
      Animated.timing(burstY, { toValue: -90, duration: 950, useNativeDriver: true }),
      Animated.timing(burstO, { toValue: 0, duration: 950, useNativeDriver: true }),
    ]).start();
  }

  async function chartCareer(force) {
    setCareerBusy(true);
    try {
      const rows = force ? await api.refreshCareer() : await api.generateCareer();
      setCareer(Array.isArray(rows) ? rows : []);
      setCareerLoaded(true);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setCareerBusy(false);
    }
  }

  async function openBook(book) {
    setSelected(book);
    setChapters([]);
    setChLoading(true);
    try {
      const rows = await api.getChapters(book.id);
      setChapters(Array.isArray(rows) ? rows : []);
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setChLoading(false);
    }
  }

  async function enroll() {
    if (!form.title.trim()) {
      Alert.alert("Missing", "Enter a book title or a subject (e.g. 'Biology').");
      return;
    }
    setEnrolling(true);
    try {
      const r = await api.enrollBook({
        title: form.title.trim(),
        author: form.author.trim(),
        level: form.level.trim(),
      });
      setModal(false);
      setForm({ title: "", author: "", level: "" });
      await load();
      if (r && r.book) {
        setSelected(r.book);
        setChapters(r.chapters || []);
      }
    } catch (e) {
      Alert.alert("The System", e.message || String(e));
    } finally {
      setEnrolling(false);
    }
  }

  async function completeChapter(ch) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fireBurst(ch.xp_reward ?? 40);
    setChapters((list) =>
      list.map((x) => (x.id === ch.id ? { ...x, status: "completed" } : x))
    );
    try {
      const r = await api.completeChapter(selected.id, ch.id);
      if (r.book_completed) {
        Alert.alert("CAMPAIGN COMPLETE", `"${selected.title}" has been conquered. Bonus intellect awarded.`);
        load();
      }
    } catch (e) {
      setChapters((list) =>
        list.map((x) => (x.id === ch.id ? { ...x, status: "active" } : x))
      );
      Alert.alert("Could not complete", e.message || String(e));
    }
  }

  function confirmDeleteBook(book) {
    Alert.alert("Abandon this book?", `"${book.title}" and its campaign will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Abandon",
        style: "destructive",
        onPress: async () => {
          setSelected(null);
          setBookList((l) => l.filter((b) => b.id !== book.id));
          try {
            await api.deleteBook(book.id);
          } catch (e) {
            Alert.alert("Could not delete", e.message || String(e));
            load();
          }
        },
      },
    ]);
  }

  // ── Book detail view (chapters) ─────────────────────────────────────────────
  if (selected) {
    const doneCount = chapters.filter((c) => c.status === "completed").length;
    return (
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.backRow} onPress={() => setSelected(null)}>
            <Ionicons name="chevron-back" size={18} color={colors.accentGlow} />
            <Text style={styles.backTxt}>BACK</Text>
          </Pressable>

          <FadeIn>
            <View style={styles.bookHeader}>
              {selected.cover_url ? (
                <Image source={{ uri: selected.cover_url }} style={styles.coverLarge} />
              ) : (
                <View style={[styles.coverLarge, styles.coverFallback]}>
                  <Ionicons name="book" size={34} color={colors.violet} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.bookTitle}>{selected.title}</Text>
                {selected.author ? <Text style={styles.bookAuthor}>{selected.author}</Text> : null}
                <Text style={styles.progress}>
                  {doneCount}/{chapters.length || "…"} UNITS CLEARED
                </Text>
                {selected.free_reader_url ? (
                  <Pressable
                    style={styles.readFree}
                    onPress={() => Linking.openURL(selected.free_reader_url).catch(() => {})}
                  >
                    <Ionicons name="book-outline" size={13} color={colors.success} />
                    <Text style={styles.readFreeTxt}>READ FREE (LEGAL)</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => confirmDeleteBook(selected)} hitSlop={8}>
                <Ionicons name="trash-outline" size={19} color={colors.textDim} />
              </Pressable>
            </View>
          </FadeIn>

          {chLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 30 }} />
          ) : (
            chapters.map((ch, i) => (
              <FadeIn key={ch.id} delay={60 + i * 40}>
                <ChapterCard book={selected} chapter={ch} onComplete={completeChapter} />
              </FadeIn>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>

        <Animated.View
          pointerEvents="none"
          style={[styles.burst, { opacity: burstO, transform: [{ translateY: burstY }] }]}
        >
          <Text style={styles.burstText}>{burstText}</Text>
        </Animated.View>
      </GradientBackground>
    );
  }

  // ── List view: header with BOOKS / CAREER toggle ────────────────────────────
  const Header = (
    <View>
      <FadeIn>
        <Text style={styles.hero}>THE ACADEMY</Text>
        <Text style={styles.heroSub}>
          {mode === "books"
            ? "Name a book or a subject (e.g. “Biology, Class 11”). The System forges it into a campaign."
            : "Where should you go? The System maps your interests to fields — weighing real growth and demand."}
        </Text>
      </FadeIn>

      <FadeIn delay={60}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, mode === "books" && styles.toggleOn]}
            onPress={() => switchMode("books")}
          >
            <Ionicons name="library" size={14} color={mode === "books" ? colors.bg : colors.textDim} />
            <Text style={[styles.toggleTxt, mode === "books" && styles.toggleTxtOn]}>STUDY</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === "career" && styles.toggleOn]}
            onPress={() => switchMode("career")}
          >
            <Ionicons name="compass" size={14} color={mode === "career" ? colors.bg : colors.textDim} />
            <Text style={[styles.toggleTxt, mode === "career" && styles.toggleTxtOn]}>CAREER</Text>
          </Pressable>
        </View>
      </FadeIn>

      {mode === "career" && career.length > 0 ? (
        <FadeIn delay={80}>
          <NeonButton
            title={careerBusy ? "RE-CHARTING" : "⟲ RE-CHART"}
            onPress={() => chartCareer(true)}
            busy={careerBusy}
            small
            grad={gradients.accent}
            style={{ alignSelf: "flex-start", marginBottom: 14 }}
          />
        </FadeIn>
      ) : null}
    </View>
  );

  const EmptyBooks = !loading ? (
    <FadeIn delay={100}>
      <GlowCard style={styles.emptyCard} glow={colors.accent}>
        <Ionicons name="school-outline" size={40} color={colors.accent} />
        <Text style={styles.emptyTitle}>NO ACTIVE CAMPAIGNS</Text>
        <Text style={styles.emptyText}>
          Enroll a book or a school subject and the System will plan your conquest of it,
          chapter by chapter.
        </Text>
        <NeonButton
          title="＋ ENROLL"
          onPress={() => setModal(true)}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
      </GlowCard>
    </FadeIn>
  ) : null;

  const EmptyCareer = (
    <FadeIn delay={100}>
      <GlowCard style={styles.emptyCard} glow={colors.accentGlow}>
        <Ionicons name="compass-outline" size={40} color={colors.accentGlow} />
        <Text style={styles.emptyTitle}>CHART YOUR PATH</Text>
        <Text style={styles.emptyText}>
          The System will read your interests and goals and recommend fields to pursue —
          with each field's growth and demand.
        </Text>
        <NeonButton
          title={careerBusy ? "CHARTING" : "GET CAREER GUIDANCE"}
          onPress={() => chartCareer(false)}
          busy={careerBusy}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
        <Text style={styles.disclaimer}>
          AI guidance based on the System's knowledge — a compass, not a guarantee.
        </Text>
      </GlowCard>
    </FadeIn>
  );

  const data = mode === "books" ? bookList : career;

  return (
    <GradientBackground>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => `${mode}-${item.id}`}
          renderItem={({ item, index }) =>
            mode === "books" ? (
              <FadeIn delay={Math.min(index * 40, 200)}>
                <Pressable onPress={() => openBook(item)}>
                  <View style={styles.bookCard}>
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback]}>
                        <Ionicons name="book" size={22} color={colors.violet} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                      {item.author ? (
                        <Text style={styles.bookAuthor} numberOfLines={1}>{item.author}</Text>
                      ) : null}
                      <View style={styles.badgeRow}>
                        {item.status === "completed" ? (
                          <Text style={styles.doneBadge}>CONQUERED ✓</Text>
                        ) : (
                          <Text style={styles.activeBadge}>IN PROGRESS</Text>
                        )}
                        {item.free_reader_url ? <Text style={styles.freeBadge}>FREE TEXT</Text> : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                  </View>
                </Pressable>
              </FadeIn>
            ) : (
              <FadeIn delay={Math.min(index * 50, 250)}>
                <CareerCard path={item} rank={index + 1} />
              </FadeIn>
            )
          }
          ListHeaderComponent={Header}
          ListEmptyComponent={mode === "books" ? EmptyBooks : EmptyCareer}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={
            mode === "books"
              ? () => {
                  setRefreshing(true);
                  load();
                }
              : undefined
          }
        />
      )}

      {/* Enroll FAB (books mode only) */}
      {mode === "books" && bookList.length > 0 ? (
        <Pressable style={styles.fab} onPress={() => setModal(true)}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
            <Ionicons name="add" size={30} color="#04122E" />
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* Enroll modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => !enrolling && setModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable style={styles.backdrop} onPress={() => !enrolling && setModal(false)} />
          <View style={styles.sheet}>
            {enrolling ? (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.enrollingTitle}>THE SYSTEM IS DESIGNING YOUR CAMPAIGN</Text>
                <Text style={styles.enrollingSub}>
                  Locating the material, checking for a legal free edition, and forging the
                  study plan. This can take up to a minute.
                </Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>ENROLL</Text>
                <Text style={styles.label}>BOOK OR SUBJECT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Atomic Habits — or 'Biology'"
                  placeholderTextColor={colors.textDim}
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                />
                <Text style={styles.label}>AUTHOR (optional — helps find a specific book)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. James Clear"
                  placeholderTextColor={colors.textDim}
                  value={form.author}
                  onChangeText={(v) => setForm((f) => ({ ...f, author: v }))}
                />
                <Text style={styles.label}>CLASS / LEVEL (optional — for school subjects)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Class 11, Undergraduate"
                  placeholderTextColor={colors.textDim}
                  value={form.level}
                  onChangeText={(v) => setForm((f) => ({ ...f, level: v }))}
                />
                <NeonButton title="FORGE THE CAMPAIGN" onPress={enroll} style={{ marginTop: 6 }} />
                <Pressable style={styles.cancelBtn} onPress={() => setModal(false)}>
                  <Text style={styles.cancelTxt}>CANCEL</Text>
                </Pressable>
                <View style={{ height: 12 }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 110 },
  hero: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  heroSub: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },

  toggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
  },
  toggleOn: { backgroundColor: colors.accent },
  toggleTxt: { color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginLeft: 6 },
  toggleTxtOn: { color: colors.bg },

  emptyCard: { alignItems: "center", marginTop: 10 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "900", letterSpacing: 2, marginTop: 12 },
  emptyText: { color: colors.textDim, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8 },
  disclaimer: { color: colors.textFaint, fontSize: 11, textAlign: "center", marginTop: 12, fontStyle: "italic" },

  bookCard: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  cover: { width: 46, height: 68, borderRadius: 6, backgroundColor: colors.surfaceAlt },
  coverLarge: { width: 64, height: 94, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  bookTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  bookAuthor: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: 6, alignItems: "center" },
  activeBadge: { color: colors.accentGlow, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginRight: 8 },
  doneBadge: { color: colors.success, fontSize: 9, fontWeight: "800", letterSpacing: 1, marginRight: 8 },
  freeBadge: { color: colors.success, fontSize: 9, fontWeight: "800", letterSpacing: 1, borderWidth: 1, borderColor: colors.success, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },

  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backTxt: { color: colors.accentGlow, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  bookHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  progress: { color: colors.accentGlow, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 6 },
  readFree: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  readFreeTxt: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginLeft: 5 },

  chCard: {
    backgroundColor: colors.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    padding: 14,
    marginBottom: 12,
  },
  chHead: { flexDirection: "row", alignItems: "center" },
  chOrdinal: { color: colors.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  chTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 1 },
  strike: { textDecorationLine: "line-through", color: colors.textDim },
  chXp: { color: colors.accentGlow, fontFamily: fonts.mono, fontWeight: "700", fontSize: 13, marginLeft: 8 },
  chObjective: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 8 },
  conceptRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  concept: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  conceptTxt: { color: colors.textDim, fontSize: 10, fontWeight: "700" },
  chActions: { flexDirection: "row", marginTop: 10 },
  chBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
  },
  chBtnTxt: { color: colors.text, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginLeft: 5 },
  notesBox: {
    backgroundColor: "rgba(124,58,237,0.08)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  notesTxt: { color: colors.text, fontSize: 13, lineHeight: 20 },

  burst: { position: "absolute", top: "42%", alignSelf: "center" },
  burstText: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: "900",
    fontFamily: fonts.mono,
    textShadowColor: colors.accent,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  fab: {
    position: "absolute",
    right: 22,
    bottom: 26,
    borderRadius: 30,
    shadowColor: colors.accentGlow,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fabInner: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,4,10,0.72)" },
  sheet: {
    backgroundColor: colors.bgAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderGlow,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "90%",
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: 2, marginBottom: 16 },
  label: { color: colors.accentGlow, fontSize: 11, letterSpacing: 1.5, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  cancelTxt: { color: colors.textDim, fontSize: 13, letterSpacing: 1.5, fontWeight: "700" },
  enrollingTitle: {
    color: colors.text, fontSize: 14, fontWeight: "900", letterSpacing: 1.5,
    marginTop: 18, textAlign: "center",
  },
  enrollingSub: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 8 },
});
