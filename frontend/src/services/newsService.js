import api from './api';

export const getNews = () => api.get('/news');
export const addNews = (newsData) => api.post('/news', newsData);