import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./screens/LoginScreen";
import { CheckInScreen } from "./screens/CheckInScreen";
import { ApprovalsScreen } from "./screens/ApprovalsScreen";
import { clearSession, getUser, SessionUser } from "./api";

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }     // Login screen
  | { kind: "gate" }          // Skipped login — check-in only
  | { kind: "authed"; user: SessionUser };

type Tab = "checkin" | "approvals";

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("checkin");

  useEffect(() => {
    getUser()
      .then((u) => setAuth(u ? { kind: "authed", user: u } : { kind: "anonymous" }))
      .catch(() => setAuth({ kind: "anonymous" }));
  }, []);

  if (auth.kind === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="light" />
        <Text style={{ color: "#64748b" }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (auth.kind === "anonymous") {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          onLoggedIn={(user) => setAuth({ kind: "authed", user })}
          onContinueAsGate={() => setAuth({ kind: "gate" })}
        />
      </>
    );
  }

  if (auth.kind === "gate") {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.flex}>
          <CheckInScreen />
          <View style={styles.tabBar}>
            <TabButton
              label="Check-in"
              active
              onPress={() => {}}
            />
            <TabButton
              label="Sign in"
              onPress={() => setAuth({ kind: "anonymous" })}
            />
          </View>
        </View>
      </>
    );
  }

  // authed
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.flex}>
        {tab === "checkin" ? (
          <CheckInScreen />
        ) : (
          <ApprovalsScreen user={auth.user} />
        )}
        <View style={styles.tabBar}>
          <TabButton
            label="Check-in"
            active={tab === "checkin"}
            onPress={() => setTab("checkin")}
          />
          <TabButton
            label="Approvals"
            active={tab === "approvals"}
            onPress={() => setTab("approvals")}
          />
          <TabButton
            label="Sign out"
            onPress={async () => {
              await clearSession();
              setAuth({ kind: "anonymous" });
            }}
          />
        </View>
      </View>
    </>
  );
}

function TabButton({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(15,23,42,0.95)",
    paddingBottom: 18,
    paddingTop: 8,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabBtnActive: {},
  tabText: { color: "#64748b", fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: "#60a5fa", fontWeight: "600" },
});
