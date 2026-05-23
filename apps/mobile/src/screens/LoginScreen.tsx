import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, setSession, SessionUser } from "../api";

interface Props {
  onLoggedIn: (user: SessionUser) => void;
  onContinueAsGate: () => void;
}

export function LoginScreen({ onLoggedIn, onContinueAsGate }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.login(email.trim(), password);
      await setSession(r.accessToken, r.user);
      onLoggedIn(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Text style={styles.title}>VMS Mobile</Text>
        <Text style={styles.subtitle}>Sign in as a host to approve visits.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="host@demo.local"
            placeholderTextColor="#64748b"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor="#64748b"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.button, (loading || !email || !password) && styles.disabled]}
            onPress={submit}
            disabled={loading || !email || !password}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>

        <Pressable onPress={onContinueAsGate} style={styles.gateBtn}>
          <Text style={styles.gateText}>Skip — use as gate kiosk (check-in only)</Text>
        </Pressable>
      </KeyboardAvoidingView>
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
  label: { color: "#cbd5e1", fontSize: 12, marginBottom: 6, marginTop: 10, textTransform: "uppercase" },
  input: {
    backgroundColor: "#020617",
    color: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  error: { color: "#fca5a5", marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  gateBtn: { marginTop: 24, padding: 12, alignItems: "center" },
  gateText: { color: "#60a5fa", fontSize: 13 },
});
