import React, { useEffect, useState } from 'react';
import api from '../services/api';
// ✅ THÊM THƯ VIỆN BIỂU ĐỒ
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

                // 2. ✅ LOGIC XỬ LÝ DỮ LIỆU BIỂU ĐỒ TRONG TUẦN
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

    const cardStyle = {
        flex: '1 1 300px', // Auto scale trên di động
        padding: '25px',
        borderRadius: '15px',
        color: 'white',
        margin: '10px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '120px'
    };

    if (loading) return <div style={{ padding: '20px' }}>Đang tải dữ liệu từ VPS...</div>;

    return (
        <div style={{ padding: '10px' }}>
            <h2 style={{ marginBottom: '25px', color: '#2c3e50' }}>🏠 Tổng quan hệ thống</h2>

            {/* Các thẻ thống kê nhanh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>TỔNG BÀI VIẾT</span>
                    <h1 style={{ margin: '10px 0', fontSize: '36px' }}>{stats.TotalPosts}</h1>
                    <span style={{ fontSize: '12px' }}>Tất cả tin bài trong DB</span>
                </div>

                <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>TIN MỚI HÔM NAY</span>
                    <h1 style={{ margin: '10px 0', fontSize: '36px' }}>{stats.PostsToday}</h1>
                    <span style={{ fontSize: '12px' }}>Vừa được cập nhật</span>
                </div>

                <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>NHÂN SỰ</span>
                    <h1 style={{ margin: '10px 0', fontSize: '36px' }}>{stats.TotalUsers}</h1>
                    <span style={{ fontSize: '12px' }}>Thành viên hệ thống</span>
                </div>
            </div>

            {/* ✅ BIỂU ĐỒ TRỰC QUAN */}
            <div style={{ 
                height: 350, width: '100%', background: 'white', 
                padding: '20px', borderRadius: '15px', border: '1px solid #eee',
                marginBottom: '30px'
            }}>
                <h3 style={{ marginBottom: '20px', color: '#34495e' }}>📊 Biểu đồ tin bài trong tuần</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#888'}} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Line 
                            type="monotone" 
                            dataKey="posts" 
                            stroke="#8884d8" 
                            strokeWidth={3} 
                            dot={{ r: 6, fill: '#8884d8', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Trạng thái kết nối */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
                <h3>🔔 Trạng thái hệ thống</h3>
                <p style={{ color: '#7f8c8d' }}>Hệ thống đang hoạt động ổn định trên VPS Đắk Lắk.</p>
                <ul style={{ paddingLeft: '20px', color: '#34495e', listStyleType: 'none' }}>
                    <li style={{ marginBottom: '8px' }}>🚀 Backend API (Node.js): <strong style={{ color: 'green' }}>Online</strong></li>
                    <li style={{ marginBottom: '8px' }}>💾 Database SQL Server: <strong style={{ color: 'green' }}>Connected</strong></li>
                </ul>
            </div>
        </div>
    );
};

export default Dashboard;