import React from 'react';
// iOS ve Android aynı iş kurallarını ve ekranları kullanır; platform farkları
// (güvenli alan, durum çubuğu) ortak bileşen içinde yönetilir.
import GastroSyncWorkspace from '../shared/GastroSyncWorkspace';

export default function IOSApp(props) {
  return <GastroSyncWorkspace {...props} />;
}
