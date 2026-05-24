import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, SessionUser } from "../api";
import { useI18n } from "../i18n";

interface Headcount {
  total: number;
  visitors: number;
  workers: number;
  employees: number;
}

export function DashboardScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const [head, setHead] = useState<Headcount | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([
        api.headcount(),
        api.pendingVisits().then((x) => x.length).catch(() => 0),
      ]);
      setHead(h);
      setPending(p);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
      }
    >
      <Text style={styles.greeting}>Hi, {user.fullName.split(" ")[0]}</Text>
      <Text style={styles.role}>{user.role.replace(/_/g, " ")}</Text>

      <View style={styles.cardsRow}>
        <Card label={t("dash.totalInside")} value={head?.total} color="#7c3aed" />
        <Card label={t("dash.pendingApprovals")} value={pending} color="#fb923c" />
      </View>

      <View style={styles.cardsGrid}>
        <Card label="Visitors" value={head?.visitors} color="#a78bfa" small />
        <Card label="Workers" value={head?.workers} color="#fbbf24" small />
        <Card label="Employees" value={head?.employees} color="#22d3ee" small />
      </View>

      <Text style={styles.refreshHint}>Pull down to refresh · auto-refreshes every 20s</Text>
    </ScrollView>
  );
}

function Card({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: number | null | undefined;
  color: string;
  small?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        small && styles.cardSmall,
        { borderTopColor: color, borderTopWidth: 3 },
      ]}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      {value == null ? (
        <ActivityIndicator color="#475569" />
      ) : (
        <Text style={[styles.cardValue, small && styles.cardValueSmall, { color }]}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a071a" },
  content: { padding: 18, paddingTop: 48, paddingBottom: 32 },
  greeting: { color: "#f8fafc", fontSize: 28, fontWeight: "700" },
  role: { color: "#94a3b8", fontSize: 12, textTransform: "uppercase", marginBottom: 24 },
  cardsRow: { flexDirection: "row", gap: 10 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardSmall: { flexBasis: "30%", padding: 14 },
  cardLabel: { color: "#94a3b8", fontSize: 11, textTransform: "uppercase", marginBottom: 6 },
  cardValue: { fontSize: 36, fontWeight: "700" },
  cardValueSmall: { fontSize: 26 },
  refreshHint: { color: "#475569", fontSize: 11, textAlign: "center", marginTop: 18 },
});
