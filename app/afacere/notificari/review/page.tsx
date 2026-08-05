"use client";

import AppShell from "../../../components/AppShell";
import AdminSubmissionReview from "../components/AdminSubmissionReview";

export default function AdminReviewPage() {
  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto w-full p-5 md:p-8">
        <AdminSubmissionReview />
      </div>
    </AppShell>
  );
}
