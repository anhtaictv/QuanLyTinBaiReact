import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IconList, IconPlus, IconUsers, IconTrendingUp, IconServer, IconDatabase } from '../components/icons';
import LoadingState from '../components/LoadingState';

const Dashboard = () => {
    const [stats, setStats] = useState({ TotalPosts: 0, TotalUsers: 0, PostsToday: 0 });
    const [chartData, setChartData] = useState([]); // State lưu dữ liệu biểu đồ
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [postsRes, usersRes] = await Promise.all([
                    api.get('/news'),
                    api.get('/users/basic')
                ]);

                const posts = Array.isArray(postsRes.data) ? postsRes.data : (postsRes.data.recordset || []);
                const users = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.recordset || []);

                // 1. Tính toán thống kê nhanh
                const todayStr = new Date().toDateString();
                const postsToday = posts.filter(p => {
                    const postDate = new Date(p.CreatedAt || p.createdAt);
                    return postDate.toDateString() === todayStr;
                }).length;

                setStats({
                    TotalPosts: posts.length,
                    TotalUsers: users.length,
                    PostsToday: postsToday
                });

                // 2. LOGIC XỬ LÝ DỮ LIỆU BIỂU ĐỒ TRONG TUẦN
                const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                const weekData = days.map(day => ({ name: day, posts: 0 }));

                posts.forEach(p => {
                    const postDate = new Date(p.CreatedAt || p.createdAt);
                    const dayName = days[postDate.getDay()];
                    const found = weekData.find(d => d.name === dayName);
                    if (found) found.posts++;
                });

                // Sắp xếp lại mảng để bắt đầu từ Thứ 2 thay vì Chủ Nhật cho thuận mắt
                const sortedData = [...weekData.slice(1), weekData[0]];
                setChartData(sortedData);

            } catch (err) {
                console.error("Lỗi Dashboard:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        { label: 'TỔNG BÀI VIẾT', value: stats.TotalPosts, hint: 'Tất cả tin bài trong hệ thống', icon: IconList },
        { label: 'TIN MỚI HÔM NAY', value: stats.PostsToday, hint: 'Vừa được cập nhật', icon: IconPlus },
        { label: 'NHÂN SỰ', value: stats.TotalUsers, hint: 'Thành viên hệ thống', icon: IconUsers },
    ];

    const cardStyle = {
        flex: '1 1 240px',
        padding: '22px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    };

    const panelStyle = {
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '20px',
    };

    if (loading) return <LoadingState label="Đang tải dữ liệu…" />;

    return (
        <div>
            <h2 style={{ marginBottom: '22px', color: 'var(--text)', fontSize: 22 }}>Tổng quan hệ thống</h2>

            {/* Các thẻ thống kê nhanh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: '20px' }}>
                {statCards.map(({ label, value, hint, icon: Icon }) => (
                    <div key={label} style={cardStyle}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                            background: 'var(--accent-soft)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Icon size={18} />
                        </div>
                        <span style={{ fontSize: 12, letterSpacing: '0.05em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
                        <h1 style={{ fontSize: 34, color: 'var(--text)' }}>{value}</h1>
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{hint}</span>
                    </div>
                ))}
            </div>

            {/* BIỂU ĐỒ TRỰC QUAN */}
            <div style={{ ...panelStyle, height: 360, marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '18px', color: 'var(--text)', fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconTrendingUp size={17} style={{ color: 'var(--accent)' }} />Biểu đồ tin bài trong tuần
                </h3>
                <ResponsiveContainer width="100%" height="88%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12.5 }} />
                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12.5 }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', background: 'var(--surface)', color: 'var(--text)' }} />
                        <Line
                            type="monotone"
                            dataKey="posts"
                            name="Bài viết"
                            stroke="var(--accent)"
                            strokeWidth={2.5}
                            dot={{ r: 5, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--surface)' }}
                            activeDot={{ r: 7 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Trạng thái kết nối */}
            <div style={panelStyle}>
                <h3 style={{ fontSize: 15.5, marginBottom: 6 }}>Trạng thái hệ thống</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 14 }}>Hệ thống đang hoạt động ổn định trên VPS Đắk Lắk.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                        <IconServer size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>Backend API (Node.js)</span>
                        <StatusPill label="Online" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                        <IconDatabase size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>Database SQL Server</span>
                        <StatusPill label="Connected" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusPill = ({ label }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        marginLeft: 'auto', background: 'var(--success-soft)', color: 'var(--success)',
        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999
    }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
        {label}
    </span>
);

export default Dashboard;
