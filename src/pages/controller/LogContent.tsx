import { useLocation } from 'react-router-dom';

export default function LogContent() {
  const location = useLocation();
  const data = (location.state as { data?: unknown } | null)?.data;
  return (
    <div>
      <p>This should be changed to multiple tabs with pagination.</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
