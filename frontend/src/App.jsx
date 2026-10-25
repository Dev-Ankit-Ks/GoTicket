
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import AppRouter from './router';

export default function App() {
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return <div>Checking your session...</div>;
  }

  return <AppRouter />;
}
