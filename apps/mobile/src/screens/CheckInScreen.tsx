import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, API_URL } from "../api";

export function CheckInScreen() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCheckIn() {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const data = await api.checkIn(token.trim());
      Alert.alert("Welcome", `Hi ${data.visitorName ?? "Visitor"}!`);
      setToken("");
    } catch (e) {
      Alert.alert("Check-in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Gate check-in</Text>
      <Text style={styles.subtitle}>Scan the QR or paste the token.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>QR token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Paste token"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.button, (!token.trim() || loading) && styles.disabled]}
          onPress={handleCheckIn}
          disabled={!token.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Check in</Text>}
        </Pressable>
      </View>

      <Text style={styles.footer}>API: {API_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0f172a" },
  container: { padding: 24, paddingTop: 48 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 24 },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  label: { color: "#cbd5e1", fontSize: 12, marginBottom: 8, textTransform: "uppercase" },
  input: {
    backgroundColor: "#020617",
    color: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  footer: { color: "#475569", fontSize: 11, marginTop: 24, textAlign: "center" },
});
