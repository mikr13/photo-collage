import PhotoCollageApp from '@/components/PhotoCollageApp';
import { DEFAULT_WORKFLOW } from '@/utils/workflows';

export default function HomePage() {
  return <PhotoCollageApp workflow={DEFAULT_WORKFLOW} />;
}
