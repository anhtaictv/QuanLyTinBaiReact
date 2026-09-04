import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToastSuccess } from '../utils/Toast';
import '../styles/ContentGenerator.css';

const ContentGenerator = () => {
  const navigate = useNavigate();
  const [contentType, setContentType] = useState('release-note');
  const [tone, setTone] = useState('professional');
  const [format, setFormat] = useState('markdown');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState(['']);
  const [bugs, setBugs] = useState(['']);
  const [notes, setNotes] = useState(['']);
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const templates = {
    'release-note': { label: '📌 Release Note', icon: '📌' },
    'feature-announcement': { label: '🎉 Feature Announcement', icon: '🎉' },
    'update-news': { label: '📰 Update & News', icon: '📰' },
    'changelog': { label: '📋 Changelog', icon: '📋' },
    'blog-post': { label: '📝 Blog Post', icon: '📝' },
    'press-release': { label: '🗣️ Press Release', icon: '🗣️' },
    'social-media': { label: '📱 Social Media', icon: '📱' },
    'html-email': { label: '📧 HTML Email', icon: '📧' },
    'custom': { label: '✏️ Custom', icon: '✏️' }
  };

  const tones = ['professional', 'casual', 'friendly', 'formal', 'creative', 'technical'];
  const formats = ['markdown', 'html', 'json', 'plain-text'];

  const addFeature = () => setFeatures([...features, '']);
  const addBug = () => setBugs([...bugs, '']);
  const addNote = () => setNotes([...notes, '']);

  const removeFeature = (i) => setFeatures(features.filter((_, idx) => idx !== i));
  const removeBug = (i) => setBugs(bugs.filter((_, idx) => idx !== i));
  const removeNote = (i) => setNotes(notes.filter((_, idx) => idx !== i));

  const updateFeature = (i, value) => {
    const updated = [...features];
    updated[i] = value;
    setFeatures(updated);
  };

  const updateBug = (i, value) => {
    const updated = [...bugs];
    updated[i] = value;
    setBugs(updated);
  };

  const updateNote = (i, value) => {
    const updated = [...notes];
    updated[i] = value;
    setNotes(updated);
  };

  const formatContent = (content) => {
    if (format === 'html') {
      return `<div class="content">${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</div>`;
    } else if (format === 'json') {
      return JSON.stringify({ content, type: contentType, tone, date: new Date().toISOString() }, null, 2);
    } else if (format === 'plain-text') {
      return content.replace(/[#*`_\-]/g, '').trim();
    }
    return content;
  };

  const generateReleaseNote = () => {
    let content = `# ${title}\n`;
    if (date) content += `**Release Date:** ${date}\n\n`;
    if (description) content += `${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      content += `## ✨ What's New\n`;
      validFeatures.forEach(f => { content += `- ${f}\n`; });
      content += '\n';
    }

    const validBugs = bugs.filter(b => b.trim());
    if (validBugs.length > 0) {
      content += `## 🐛 Bug Fixes\n`;
      validBugs.forEach(b => { content += `- ${b}\n`; });
      content += '\n';
    }

    const validNotes = notes.filter(n => n.trim());
    if (validNotes.length > 0) {
      content += `## 📌 Important Notes\n`;
      validNotes.forEach(n => { content += `- ${n}\n`; });
    }

    return content.trim();
  };

  const generateFeatureAnnouncement = () => {
    let content = `# 🎉 ${title}\n\n`;
    if (date) content += `*Released on ${date}*\n\n`;
    if (description) content += `## Overview\n${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      content += `## Key Benefits\n`;
      validFeatures.forEach(f => { content += `- ${f}\n`; });
      content += '\n';
    }

    const validBugs = bugs.filter(b => b.trim());
    if (validBugs.length > 0) {
      content += `## Also Fixed\n`;
      validBugs.forEach(b => { content += `- ${b}\n`; });
      content += '\n';
    }

    const validNotes = notes.filter(n => n.trim());
    if (validNotes.length > 0) {
      content += `## Things to Know\n`;
      validNotes.forEach(n => { content += `- ${n}\n`; });
    }

    return content.trim();
  };

  const generateUpdateNews = () => {
    let content = `# ${title}\n`;
    if (date) content += `${date}\n\n`;
    if (description) content += `${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    const validBugs = bugs.filter(b => b.trim());

    if (validFeatures.length > 0 || validBugs.length > 0) {
      content += `## Changes\n`;
      if (validFeatures.length > 0) {
        content += `**New:**\n`;
        validFeatures.forEach(f => { content += `- ${f}\n`; });
      }
      if (validBugs.length > 0) {
        if (validFeatures.length > 0) content += '\n';
        content += `**Fixed:**\n`;
        validBugs.forEach(b => { content += `- ${b}\n`; });
      }
      content += '\n';
    }

    const validNotes = notes.filter(n => n.trim());
    if (validNotes.length > 0) {
      content += `## Notes\n`;
      validNotes.forEach(n => { content += `- ${n}\n`; });
    }

    return content.trim();
  };

  const generateChangelog = () => {
    let content = `## ${title}\n`;
    if (date) content += `**${date}**\n\n`;
    if (description) content += `${description}\n\n`;

    features.filter(f => f.trim()).forEach(f => {
      content += `- ✨ ${f}\n`;
    });

    bugs.filter(b => b.trim()).forEach(b => {
      content += `- 🐛 ${b}\n`;
    });

    notes.filter(n => n.trim()).forEach(n => {
      content += `- 📌 ${n}\n`;
    });

    return content.trim();
  };

  const generateBlogPost = () => {
    let content = `# ${title}\n\n`;
    content += `*Published on ${date || new Date().toLocaleDateString()}*\n\n`;
    if (description) content += `${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      content += `## Key Points\n`;
      validFeatures.forEach(f => { content += `- ${f}\n`; });
      content += '\n';
    }

    const validNotes = notes.filter(n => n.trim());
    if (validNotes.length > 0) {
      content += `## Summary\n`;
      validNotes.forEach(n => { content += `${n}\n`; });
    }

    return content.trim();
  };

  const generatePressRelease = () => {
    let content = `FOR IMMEDIATE RELEASE\n\n`;
    content += `${title}\n`;
    content += `${date}\n\n`;
    if (description) content += `${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      content += `Key Features:\n`;
      validFeatures.forEach(f => { content += `• ${f}\n`; });
      content += '\n';
    }

    content += `###\n`;
    return content.trim();
  };

  const generateSocialMedia = () => {
    let content = `🚀 ${title}\n\n`;
    if (description) content += `${description}\n\n`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      validFeatures.slice(0, 3).forEach((f, i) => {
        content += `${i + 1}️⃣ ${f}\n`;
      });
      content += '\n';
    }

    content += `#news #update #${title.toLowerCase().replace(/\s+/g, '')}`;
    return content.trim();
  };

  const generateHtmlEmail = () => {
    let html = `<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">`;
    html += `<h1 style="color: #333;">${title}</h1>`;
    if (date) html += `<p style="color: #666; font-size: 12px;">${date}</p>`;
    if (description) html += `<p style="color: #333; line-height: 1.6;">${description}</p>`;

    const validFeatures = features.filter(f => f.trim());
    if (validFeatures.length > 0) {
      html += `<h2 style="color: #333;">What's New</h2><ul>`;
      validFeatures.forEach(f => {
        html += `<li style="margin-bottom: 8px;">${f}</li>`;
      });
      html += `</ul>`;
    }

    html += `</body></html>`;
    return html;
  };

  const getSystemPrompt = useCallback(() => {
    const basePrompt = `Luôn trả lời hoàn toàn bằng tiếng Việt, kể cả khi câu hỏi được viết bằng ngôn ngữ khác. Tuyệt đối không chèn tiếng Trung hay ngôn ngữ khác, trừ tên riêng và thuật ngữ không có từ tiếng Việt tương đương.`;

    const prompts = {
      'release-note': `${basePrompt}\n\nBạn là chuyên gia viết Release Note. Tạo một Release Note chuyên nghiệp, rõ ràng, tập trung vào các thay đổi quan trọng. Sử dụng Markdown format.`,
      'feature-announcement': `${basePrompt}\n\nBạn là chuyên gia marketing. Viết một Feature Announcement hấp dẫn, làm nổi bật lợi ích cho người dùng. Tone: enthusiastic nhưng chuyên nghiệp.`,
      'update-news': `${basePrompt}\n\nBạn là nhà báo công nghệ. Viết một tin cập nhật về sản phẩm/dịch vụ. Giữ nội dung ngắn gọn, dễ đọc, tập trung vào "có gì mới".`,
      'changelog': `${basePrompt}\n\nBạn là kỹ sư phần mềm. Viết Changelog chi tiết, liệt kê từng thay đổi rõ ràng với emoji phù hợp (✨ = tính năng mới, 🐛 = bug fix, 📌 = ghi chú).`,
      'blog-post': `${basePrompt}\n\nBạn là blogger công nghệ. Viết một bài blog informative, engaging, có giá trị cho người đọc. Thêm insights và tips hữu ích.`,
      'press-release': `${basePrompt}\n\nBạn là chuyên gia PR. Viết Press Release chuyên nghiệp, phù hợp công bố báo chí, kèm quotes nếu cần.`,
      'social-media': `${basePrompt}\n\nBạn là Social Media Manager. Viết bài post ngắn, catchy, dễ share. Thêm hashtag phù hợp và call-to-action.`,
      'html-email': `${basePrompt}\n\nBạn là Email Designer. Viết nội dung email marketing, có structure rõ ràng, CTA rõ ràng, dễ đọc trên mobile.`,
      'custom': basePrompt
    };

    return prompts[contentType] || prompts['custom'];
  }, [contentType]);

  const generateWithAI = useCallback(async (template) => {
    const BASE_URL = import.meta.env.VITE_API_URL || '/api';

    const messages = [
      { role: 'system', content: getSystemPrompt() },
      {
        role: 'user',
        content: `Tạo nội dung dựa trên thông tin sau:\n\nTiêu đề: ${title}\nNgày: ${date || 'Không có'}\nMô tả: ${description || 'Không có'}\nTính năng: ${features.filter(f => f.trim()).join(', ') || 'Không có'}\nBug Fix: ${bugs.filter(b => b.trim()).join(', ') || 'Không có'}\nGhi chú: ${notes.filter(n => n.trim()).join(', ') || 'Không có'}\n\nViết theo format ${template} với tone ${tone}. Định dạng output: ${format}`
      }
    ];

    try {
      const response = await fetch(`${BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Không có kết quả từ AI';
    } catch (error) {
      console.error('AI generation error:', error);
      throw error;
    }
  }, [title, date, description, features, bugs, notes, contentType, tone, format, getSystemPrompt]);

  const handleGenerate = useCallback(async () => {
    if (!title.trim()) {
      setStatus('Vui lòng nhập Tiêu đề');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      let content = '';
      const templateName = templates[contentType]?.label || contentType;

      try {
        content = await generateWithAI(templateName);
      } catch (aiError) {
        console.warn('AI generation failed, falling back to template:', aiError);
        switch(contentType) {
          case 'release-note':
            content = generateReleaseNote();
            break;
          case 'feature-announcement':
            content = generateFeatureAnnouncement();
            break;
          case 'update-news':
            content = generateUpdateNews();
            break;
          case 'changelog':
            content = generateChangelog();
            break;
          case 'blog-post':
            content = generateBlogPost();
            break;
          case 'press-release':
            content = generatePressRelease();
            break;
          case 'social-media':
            content = generateSocialMedia();
            break;
          case 'html-email':
            content = generateHtmlEmail();
            break;
          case 'custom':
            content = description || 'No content provided';
            break;
          default:
            content = generateReleaseNote();
        }
      }

      const formattedContent = formatContent(content);
      setGeneratedContent(formattedContent);
      setStatus('✅ Nội dung được tạo thành công!');
    } catch (error) {
      setStatus('❌ Lỗi khi tạo nội dung');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [title, contentType, tone, format, description, features, bugs, notes, templates, generateWithAI]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent).then(() => {
      showToastSuccess('Đã sao chép vào clipboard!');
    });
  };

  const handleUseAsNewsContent = () => {
    navigate('/news/create', {
      state: {
        tieuDe: title,
        sapo: description.substring(0, 200),
        noiDung: generatedContent
      }
    });
  };

  const handleClear = () => {
    setTitle('');
    setDate('');
    setDescription('');
    setFeatures(['']);
    setBugs(['']);
    setNotes(['']);
    setGeneratedContent('');
    setStatus('');
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const showFields = contentType !== 'custom' && contentType !== 'social-media';

  return (
    <div className="cg-main">
      <div className="cg-top-bar">
        <div className="cg-top-title">
          <button className="cg-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div>
            <h1>📝 Content Generator</h1>
            <p>Tạo nội dung tin bài thông minh từ thông tin cung cấp</p>
          </div>
        </div>
      </div>

      <div className="cg-workspace">
        {/* SIDEBAR */}
        <div className={`cg-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="cg-templates-section">
            <h3>📋 Templates</h3>
            <div className="cg-template-grid">
              {Object.entries(templates).map(([key, template]) => (
                <button
                  key={key}
                  className={`cg-template-btn ${contentType === key ? 'active' : ''}`}
                  onClick={() => setContentType(key)}
                  title={template.label}
                >
                  {template.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="cg-options-section">
            <div className="cg-option-group">
              <label>🎯 Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="cg-select-sm">
                {tones.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="cg-option-group">
              <label>📄 Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="cg-select-sm">
                {formats.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="cg-content">
          <div className="cg-editor-panel">
            <div className="cg-panel-header">
              <h2>📝 Thông tin bài viết</h2>
            </div>

            {status && (
              <div className={`cg-status ${status.includes('✅') ? 'success' : 'error'}`}>
                {status}
              </div>
            )}

            <div className="cg-form-group">
              <label>Tiêu đề *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Version 2.1.0"
                className="cg-input"
              />
            </div>

            <div className="cg-form-group">
              <label>Ngày phát hành</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g., 2026-09-05"
                className="cg-input"
              />
            </div>

            <div className="cg-form-group">
              <label>Mô tả / Nội dung tổng quan</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Main description..."
                className="cg-textarea"
              />
            </div>

            {showFields && (
              <>
                <div className="cg-items-section">
                  <h3>✨ Tính năng</h3>
                  <div className="cg-items-list">
                    {features.map((f, i) => (
                      <div key={i} className="cg-item">
                        <input
                          type="text"
                          value={f}
                          onChange={(e) => updateFeature(i, e.target.value)}
                          placeholder="Mô tả tính năng..."
                          className="cg-item-input"
                        />
                        {features.length > 1 && (
                          <button className="cg-item-remove" onClick={() => removeFeature(i)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="cg-add-item-btn" onClick={addFeature}>+ Thêm</button>
                </div>

                <div className="cg-items-section">
                  <h3>🐛 Bug Fix</h3>
                  <div className="cg-items-list">
                    {bugs.map((b, i) => (
                      <div key={i} className="cg-item">
                        <input
                          type="text"
                          value={b}
                          onChange={(e) => updateBug(i, e.target.value)}
                          placeholder="Mô tả bug fix..."
                          className="cg-item-input"
                        />
                        {bugs.length > 1 && (
                          <button className="cg-item-remove" onClick={() => removeBug(i)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="cg-add-item-btn" onClick={addBug}>+ Thêm</button>
                </div>

                <div className="cg-items-section">
                  <h3>📌 Ghi chú</h3>
                  <div className="cg-items-list">
                    {notes.map((n, i) => (
                      <div key={i} className="cg-item">
                        <input
                          type="text"
                          value={n}
                          onChange={(e) => updateNote(i, e.target.value)}
                          placeholder="Ghi chú..."
                          className="cg-item-input"
                        />
                        {notes.length > 1 && (
                          <button className="cg-item-remove" onClick={() => removeNote(i)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="cg-add-item-btn" onClick={addNote}>+ Thêm</button>
                </div>
              </>
            )}

            <div className="cg-actions">
              <button
                className="cg-btn-primary"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? '⏳ Tạo nội dung...' : '🚀 Tạo nội dung'}
              </button>
              <button className="cg-btn-secondary" onClick={handleClear}>
                🔄 Xóa
              </button>
            </div>
          </div>

          {/* PREVIEW PANEL */}
          <div className="cg-preview-panel">
            <div className="cg-panel-header">
              <h2>👁️ Xem trước</h2>
              <div className="cg-preview-info">
                {generatedContent && (
                  <span className="cg-char-count">{generatedContent.length} ký tự</span>
                )}
              </div>
            </div>

            <div className="cg-output-area">
              <div className="cg-output-content">
                {generatedContent ? (
                  format === 'html-email' ? (
                    <iframe
                      srcDoc={generatedContent}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '4px' }}
                      title="Email Preview"
                    />
                  ) : (
                    <pre>{generatedContent}</pre>
                  )
                ) : (
                  <div className="cg-empty-state">
                    <p>Nội dung sẽ xuất hiện ở đây...</p>
                    <small>Điền thông tin và nhấn "Tạo nội dung"</small>
                  </div>
                )}
              </div>
            </div>

            <div className="cg-output-actions">
              <button
                className="cg-btn-action cg-btn-copy"
                onClick={handleCopyToClipboard}
                disabled={!generatedContent}
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
              <button
                className="cg-btn-action cg-btn-download"
                onClick={handleDownload}
                disabled={!generatedContent}
                title="Download as text"
              >
                ⬇️ Download
              </button>
              <button
                className="cg-btn-action cg-btn-use"
                onClick={handleUseAsNewsContent}
                disabled={!generatedContent}
                title="Use in news form"
              >
                📝 Sử dụng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentGenerator;
