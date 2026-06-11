import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function OldProfileRoute({ params }: Props) {
  const { userId } = await params;
  redirect(`/users/${userId}`);
}
