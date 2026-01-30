export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-gradient flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-6">
        <div className="rounded-2xl border border-[#DEDDDB] bg-white p-10 shadow-lg dark:border-[#3D3935] dark:bg-[#363230]">
          {children}
        </div>
      </div>
    </div>
  );
}
