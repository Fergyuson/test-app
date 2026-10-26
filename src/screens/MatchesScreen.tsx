import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL } from '../config';
import { useFavorites } from '../hooks/useFavorites';

type Team = { id: string; name: string; city: string };
type Match = {
  id: string;
  startsAt: string | null;
  status: string;
  home: Team;
  away: Team;
  score: { home: number; away: number } | null;
  minute?: number;
};
type MatchesResponse = { round: number; matches: Match[] };
type Filter = 'all' | 'scheduled' | 'finished';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'scheduled', label: 'Предстоящие' },
  { value: 'finished', label: 'Завершённые' },
];

const statusLabels: Record<string, string> = {
  scheduled: 'Предстоящий',
  live: 'Идёт матч',
  finished: 'Завершён',
  postponed: 'Перенесён',
  cancelled: 'Отменён',
};

function formatStart(startsAt: string | null): string {
  if (!startsAt) return 'Дата уточняется';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  return date.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

function belongsToFilter(match: Match, filter: Filter): boolean {
  if (filter === 'all') return true;
  return match.status === filter;
}

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggle } = useFavorites();

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(MATCHES_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: MatchesResponse = await response.json();
      if (!Array.isArray(data.matches)) throw new Error('Некорректный ответ сервера');
      setMatches(data.matches);
      setRound(data.round);
      setUpdatedAt(new Date());
    } catch {
      setError('Не удалось загрузить матчи. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMatches(); }, [loadMatches]);

  const visibleMatches = matches?.filter((match) => belongsToFilter(match, filter)) ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Матчи тура{round !== null ? ` ${round}` : ''}</Text>
      <View style={styles.toolbar}>
        {updatedAt && <UpdatedAgo since={updatedAt} />}
        <Pressable onPress={() => void loadMatches()} disabled={loading} accessibilityRole="button" style={styles.refreshButton}>
          <Text style={styles.refreshText}>{loading && matches ? 'Обновляем…' : 'Обновить'}</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable key={item.value} onPress={() => setFilter(item.value)} accessibilityRole="button"
            accessibilityState={{ selected: filter === item.value }}
            style={[styles.filterButton, filter === item.value && styles.selectedFilter]}>
            <Text style={[styles.filterText, filter === item.value && styles.selectedFilterText]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {error && (
        <View style={styles.message}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void loadMatches()} accessibilityRole="button">
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}
      {loading && !matches ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2457a7" />
          <Text style={styles.muted}>Загружаем матчи…</Text>
        </View>
      ) : (
        <FlatList data={visibleMatches} keyExtractor={(match) => match.id} contentContainerStyle={styles.list}
          ListEmptyComponent={!error ? (
            <Text style={styles.emptyText}>
              {matches?.length === 0 ? 'Матчей пока нет.' : 'В этой категории матчей нет.'}
            </Text>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.status}>{statusLabels[item.status] ?? 'Статус уточняется'}</Text>
                <FavoriteButton active={isFavorite(item.id)} onPress={() => toggle(item.id)} />
              </View>
              <View style={styles.teams}>
                <Text style={styles.teamName}>{item.home.name}</Text>
                <Text style={styles.score}>{item.score ? `${item.score.home} : ${item.score.away}` : '— : —'}</Text>
                <Text style={styles.teamName}>{item.away.name}</Text>
              </View>
              <Text style={styles.date}>{formatStart(item.startsAt)}</Text>
              {item.status === 'live' && item.minute != null && (
                <Text style={styles.liveMinute}>{item.minute}′ минута</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f8fb' },
  title: { fontSize: 26, fontWeight: '700', color: '#172b4d', marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  refreshButton: { paddingVertical: 6, paddingHorizontal: 10 },
  refreshText: { color: '#2457a7', fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  filterButton: { borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#e8edf5' },
  selectedFilter: { backgroundColor: '#2457a7' },
  filterText: { color: '#334155', fontSize: 13 },
  selectedFilterText: { color: '#fff', fontWeight: '600' },
  list: { paddingBottom: 20, flexGrow: 1 },
  card: { padding: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  status: { color: '#53647b', fontSize: 13, fontWeight: '600' },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  teamName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#172b4d' },
  score: { fontSize: 18, fontWeight: '700', color: '#172b4d' },
  date: { color: '#64748b', marginTop: 12, fontSize: 13 },
  liveMinute: { color: '#b42318', marginTop: 4, fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  muted: { color: '#64748b' },
  message: { padding: 12, borderRadius: 8, backgroundColor: '#fff1f0', marginBottom: 12 },
  errorText: { color: '#9f2d20', marginBottom: 6 },
  retryText: { color: '#2457a7', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 48 },
});
