import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';

export const ProfileModal = ({ onClose }) => {
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setError('');
    setIsChangingPassword(true);
    try {
      const result = await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setPasswordMessage(result.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSavedOk(false);
    if (!fullName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        statusMessage: statusMessage.trim(),
        avatarUrl: avatarUrl.trim() || undefined
      });
      setSavedOk(true);
      setTimeout(() => {
        setSavedOk(false);
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const previewAvatar =
    avatarUrl.trim() ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${fullName || user?.username || 'User'}`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel profile-modal-panel" role="dialog" aria-modal="true" aria-label="Edit Profile">
        <div className="modal-header">
          <h2 className="modal-title">Edit Profile</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body profile-form">
          {/* Avatar Preview */}
          <div className="profile-avatar-section">
            <img
              src={previewAvatar}
              alt="Avatar preview"
              className="profile-avatar-preview"
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'User'}`;
              }}
            />
            <div className="profile-avatar-info">
              <span className="profile-username">@{user?.username}</span>
              <span className="profile-email">{user?.email}</span>
            </div>
          </div>

          {/* Display Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="profile-fullname">Display Name</label>
            <input
              id="profile-fullname"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              maxLength={60}
              required
            />
          </div>

          <div className="form-group">
            <h3 className="modal-title">Change password</h3>
            <label className="form-label" htmlFor="current-password">Current password</label>
            <input id="current-password" type="password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            <label className="form-label" htmlFor="new-password">New password</label>
            <input id="new-password" type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" />
            {passwordMessage && <p className="form-success">{passwordMessage}</p>}
            <button type="button" className="btn-secondary" onClick={handlePasswordChange} disabled={isChangingPassword || !currentPassword || newPassword.length < 6}>
              {isChangingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>

          {/* Status Message */}
          <div className="form-group">
            <label className="form-label" htmlFor="profile-status">Status Message</label>
            <input
              id="profile-status"
              type="text"
              className="form-input"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Available to collaborate"
              maxLength={120}
            />
            <span className="form-hint">{statusMessage.length}/120</span>
          </div>

          {/* Avatar URL */}
          <div className="form-group">
            <label className="form-label" htmlFor="profile-avatar-url">Avatar URL <span className="form-label-optional">(optional)</span></label>
            <input
              id="profile-avatar-url"
              type="url"
              className="form-input"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/your-photo.jpg"
            />
            <span className="form-hint">Leave blank to auto-generate from your name.</span>
          </div>

          {error && <p className="form-error">{error}</p>}
          {savedOk && <p className="form-success">✓ Profile updated!</p>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? (
                <><span className="spinner-sm"></span> Saving…</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;



