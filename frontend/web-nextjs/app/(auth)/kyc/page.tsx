'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AuthHeading } from '@/components/auth/auth-shell';
import { Alert, SubmitButton } from '@/components/auth/feedback';
import { SelectField } from '@/components/auth/fields';
import { FileUpload } from '@/components/auth/file-upload';
import { KycStatusCard } from '@/components/auth/kyc-status';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/auth/api';
import { AuthError } from '@/lib/auth/errors';
import { ROLE_HOME } from '@/lib/auth/routes';
import { DOCUMENT_LABELS, type DocumentType, type KycStatus, type Role } from '@/lib/auth/types';

/** Fallback list when the backend does not send required_documents for a role. */
const ROLE_DOCUMENTS: Partial<Record<Role, DocumentType[]>> = {
  retailer: ['NATIONAL_ID', 'PASSPORT', 'BUSINESS_REGISTRATION', 'TAX_PIN_CERTIFICATE'],
  wholesaler: ['NATIONAL_ID', 'PASSPORT', 'BUSINESS_REGISTRATION', 'TAX_PIN_CERTIFICATE'],
  gov_analyst: ['NATIONAL_ID', 'PASSPORT'],
};

const ROLE_INTRO: Partial<Record<Role, string>> = {
  retailer:
    'To activate your retailer account, we need to verify your identity and business information.',
  wholesaler:
    'To activate your wholesaler account, we need to verify your identity and business information.',
  gov_analyst: 'To open the government dashboard, we need to verify your identity.',
};

function KycScreen() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ documentType?: string; files?: string }>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);

  if (!user) return null;

  const status: KycStatus = user.kyc_status ?? 'PENDING';
  const options = user.kyc_required_documents ?? ROLE_DOCUMENTS[user.role] ?? ['NATIONAL_ID'];
  const canSubmit = status === 'PENDING' || status === 'REJECTED' || status === 'NEEDS_MORE_INFO';

  async function submit() {
    if (pending) return;
    const next = {
      documentType: documentType ? undefined : 'Choose the document you are sending.',
      files: files.length ? undefined : 'Add at least one document.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setFormError(null);
    setPending(true);
    try {
      await authApi.submitKyc(documentType as DocumentType, files);
      await refreshUser();
      setFiles([]);
      setDocumentType('');
    } catch (caught) {
      setFormError(
        caught instanceof AuthError
          ? caught
          : new AuthError('SERVER_ERROR', 'Something went wrong on our side. Please try again in a moment.')
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <KycStatusCard status={status} reason={user.kyc_reason}>
        {status === 'APPROVED' && (
          <button
            type="button"
            onClick={() => router.replace(ROLE_HOME[user.role])}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white"
          >
            Go to my dashboard
          </button>
        )}
      </KycStatusCard>

      {canSubmit && (
        <>
          {ROLE_INTRO[user.role] && (
            <AuthHeading title="Verify your account" description={ROLE_INTRO[user.role]} />
          )}

          {formError && <Alert tone="error">{formError.message}</Alert>}

          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <SelectField
              id="kyc-document-type"
              label="Document type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
              error={errors.documentType}
              disabled={pending}
            >
              <option value="">Choose a document</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {DOCUMENT_LABELS[option]}
                </option>
              ))}
            </SelectField>

            <FileUpload
              id="kyc-documents"
              label="Upload your document"
              hint="Make sure the whole document is visible and the text is readable."
              files={files}
              onChange={setFiles}
              uploading={pending}
              disabled={pending}
              error={errors.files}
            />

            <SubmitButton pending={pending} pendingLabel="Submitting documents…">
              Submit for verification
            </SubmitButton>
          </form>
        </>
      )}

      {status === 'SUBMITTED' && (
        <Alert tone="info">
          You can keep using the parts of MarketPay that are already open to you while we check your
          documents.
        </Alert>
      )}

      <button
        type="button"
        onClick={async () => {
          await logout();
          router.replace('/login');
        }}
        className="w-full rounded text-sm font-medium text-action underline-offset-4 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

export default function KycPage() {
  return (
    <AuthGuard allowUnverified>
      <KycScreen />
    </AuthGuard>
  );
}
