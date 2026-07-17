import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { IconNewspaper, IconRefresh, IconClock } from '../components/icons';
import LoadingState from '../components/LoadingState';

const currentUser = JSON.parse(localStorage.getItem('user'));
const userRole = (currentUser?.role || currentUser?.Role || '').toLowerCase();
const canRefresh = ['admin', 'trưởng ban', 'thư ký'].includes(userRole);

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const NewsDigest = () => {
    const [items, setItems] = useState([]);
    const [sources, setSources] = useState([]);
    const [sourceFilter, setSourceFilter] = useState('');
    const [lastFetchedAt, setLastFetchedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (sourceFilter) params.source = sourceFilter;
            const res = await api.get('/news-digest', { params });
            setItems(res.data.items || []);
            setSources(res.data.sources || []);
            setLastFetchedAt(res.data.lastFetchedAt);
        } catch (err) {
            console.error('Lỗi khi tải tổng hợp tin:', err);
        } finally {
            setLoading(false);
        }
    }, [sourceFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRefreshNow = async () => {
        setRefreshing(true);
        try {
            const res = await api.post('/news-digest/refresh');
            const { matched, inserted } = res.data;
            alert(`Đã quét xong: khớp ${matched} bài, thêm mới ${inserted} bài.`);
            await fetchData();
        } catch (err) {
            alert('Lỗi khi cập nhật tin: ' + (err.response?.data?.error || 'Lỗi kết nối'));
        } finally {
            setRefreshing(false);
        }
    };

    const filterBtnStyle = (active) => ({
        padding: '7px 14px', background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--text)', border: 'none', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', fontSize: 13, fontWeight: 600
    });

    if (loading) return <LoadingState label="Đang tải tổng hợp tin…" />;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ fontSize: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconNewspaper size={22} />Tổng hợp tin địa phương
                </h2>
                {canRefresh && (
                    <button onClick={handleRefreshNow} disabled={refreshing} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                        background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                        cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 600,
                        opacity: refreshing ? 0.6 : 1
                    }}>
                        <IconRefresh size={15} />{refreshing ? 'Đang quét...' : 'Cập nhật ngay'}
                    </button>
                )}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Tin được gom tự động từ RSS các báo lớn, lọc theo từ khóa địa danh Đắk Lắk — chưa qua kiểm duyệt biên tập,
                chỉ mang tính tham khảo nhanh. Cập nhật lần gần nhất: {lastFetchedAt ? formatDate(lastFetchedAt) : 'chưa có dữ liệu'}.
            </p>

            {sources.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button onClick={() => setSourceFilter('')} style={filterBtnStyle(!sourceFilter)}>Tất cả nguồn</button>
                    {sources.map(s => (
                        <button key={s} onClick={() => setSourceFilter(s)} style={filterBtnStyle(sourceFilter === s)}>{s}</button>
                    ))}
                </div>
            )}

            {items.length === 0 ? (
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: 40, textAlign: 'center', color: 'var(--text-muted)'
                }}>
                    Chưa có tin nào được tổng hợp{canRefresh ? ' — bấm "Cập nhật ngay" để quét lần đầu.' : '.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(item => (
                        <a
                            key={item.ItemID}
                            href={item.Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'block', background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)', padding: '14px 16px', textDecoration: 'none', color: 'inherit'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft, rgba(0,0,0,0.06))',
                                    padding: '3px 9px', borderRadius: 999
                                }}>{item.SourceName}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                                    <IconClock size={12} />{formatDate(item.PublishedAt) || formatDate(item.FetchedAt)}
                                </span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: item.Summary ? 6 : 0 }}>{item.Title}</div>
                            {item.Summary && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.Summary}</div>
                            )}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewsDigest;
