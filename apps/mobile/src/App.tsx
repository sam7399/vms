import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCheckIn() {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/gate/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeToken: token.trim() }),
      });
      if (!res.ok) {
        const body = await res.text();
        Alert.alert("Check-in failed", body || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      Alert.alert("Welcome", `Hi ${data.visitorName ?? "Visitor"}!`);
      setToken("");
    } catch (err) {
      Alert.alert(
        "Network error",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.title}>VMS Mobile</Text>
        <Text style={styles.subtitle}>Visitor & worker check-in</Text>

        <View style={styles.card}>
          <Text style={styles.label}>QR token</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="Paste or scan token"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.button, (!token.trim() || loading) && styles.buttonDisabled]}
            onPress={handleCheckIn}
            disabled={!token.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Check in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>API: {API_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { color: "#f8fafc", fontSize: 32, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 14, marginBottom: 32 },
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
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  footer: { color: "#475569", fontSize: 11, marginTop: 24, textAlign: "center" },
});
