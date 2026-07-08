import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ActivityInviteRedirectPage({ params, searchParams }: Props) {
  const { activityId } = await params;
  const sParams = await searchParams;
  
  // Construct search query
  const queryParts: string[] = [];
  Object.keys(sParams).forEach(key => {
    const value = sParams[key];
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
      } else {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
  });
  
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  
  redirect(`/activities/${activityId}/invite${queryString}`);
}
