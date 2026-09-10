import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KycPage from '@/app/(auth)/kyc/page';
import AccountStatusPage from '@/app/(auth)/account-status/page';
import { AuthGuard } from '@/components/auth/auth-guard';
import { makeUser, mockApi, noSession, renderWithAuth, router, setPathname } from './helpers';

const ME = 'GET /api/v1/users/me';
const KYC = 'POST /api/v1/users/kyc';

const retailer = (overrides = {}) =>
  makeUser({ role: 'retailer', kyc_status: 'PENDING', ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  setPathname('/');
});

describe('KYC onboarding', () => {
  it('explains what a retailer must verify and offers the accepted documents', async () => {
    mockApi({ [ME]: { data: retailer() } });
    renderWithAuth(<KycPage />);

    expect(await screen.findByText(/verify your identity and business information/)).toBeInTheDocument();
    const select = screen.getByLabelText('Document type');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('National ID / Huduma Namba');
    expect(options).toContain('Business registration certificate');
    expect(options).toContain('Tax PIN certificate');
  });

  it('uses the document list the backend supplies over the role default', async () => {
    mockApi({ [ME]: { data: retailer({ kyc_required_documents: ['PASSPORT'] }) } });
    renderWithAuth(<KycPage />);

    const select = await screen.findByLabelText('Document type');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['', 'PASSPORT']);
  });

  it('requires both a document type and a file before submitting', async () => {
    const { calls } = mockApi({ [ME]: { data: retailer() } });
    renderWithAuth(<KycPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Submit for verification' }));

    expect(await screen.findByText('Choose the document you are sending.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one document.')).toBeInTheDocument();
    expect(calls.some((entry) => entry.key === KYC)).toBe(false);
  });

  it('uploads a document, previews it and submits it', async () => {
    const { calls } = mockApi({
      [ME]: { data: retailer() },
      [KYC]: { data: { status: 'SUBMITTED' } },
    });
    renderWithAuth(<KycPage />);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Document type'), 'NATIONAL_ID');
    const file = new File(['id-scan'], 'national-id.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Upload your document'), file);

    expect(await screen.findByText('national-id.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove national-id.png' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit for verification' }));
    await waitFor(() => expect(calls.some((entry) => entry.key === KYC)).toBe(true));
  });

  it('lets a document be removed before submitting', async () => {
    mockApi({ [ME]: { data: retailer() } });
    renderWithAuth(<KycPage />);
    const user = userEvent.setup();

    const file = new File(['x'], 'permit.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Upload your document'), file);
    expect(await screen.findByText('permit.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove permit.pdf' }));
    expect(screen.queryByText('permit.pdf')).not.toBeInTheDocument();
  });

  it('shows the pending state without claiming approval', async () => {
    mockApi({ [ME]: { data: retailer({ kyc_status: 'SUBMITTED' }) } });
    renderWithAuth(<KycPage />);

    expect(await screen.findByText('Verification submitted')).toBeInTheDocument();
    expect(screen.getByText(/are checking them/)).toBeInTheDocument();
    expect(screen.queryByText(/Verification complete/)).not.toBeInTheDocument();
    // Nothing to re-upload while a decision is outstanding.
    expect(
      screen.queryByRole('button', { name: 'Submit for verification' })
    ).not.toBeInTheDocument();
  });

  it('shows approval and a way onward', async () => {
    mockApi({ [ME]: { data: retailer({ kyc_status: 'APPROVED' }) } });
    renderWithAuth(<KycPage />);

    expect(await screen.findByText('Verification complete')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go to my dashboard' }));
    expect(router.replace).toHaveBeenCalledWith('/dashboard/retailer');
  });

  it('shows a rejection with the safe reason and a way to resubmit', async () => {
    mockApi({
      [ME]: {
        data: retailer({ kyc_status: 'REJECTED', kyc_reason: 'The photo was too blurred to read.' }),
      },
    });
    renderWithAuth(<KycPage />);

    expect(await screen.findByText('Verification unsuccessful')).toBeInTheDocument();
    expect(screen.getByText(/too blurred/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeInTheDocument();
  });

  it('asks for the missing item when more information is needed', async () => {
    mockApi({
      [ME]: {
        data: retailer({
          kyc_status: 'NEEDS_MORE_INFO',
          kyc_reason: 'Send your tax PIN certificate as well.',
        }),
      },
    });
    renderWithAuth(<KycPage />);

    expect(await screen.findByText('We need a little more')).toBeInTheDocument();
    expect(screen.getByText(/tax PIN certificate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeInTheDocument();
  });
});

describe('account status', () => {
  it('states a suspension without leaking the reason', async () => {
    mockApi({ [ME]: { data: makeUser({ status: 'SUSPENDED' }) } });
    renderWithAuth(<AccountStatusPage />);

    expect(await screen.findByText('Your account is on hold')).toBeInTheDocument();
    expect(screen.getByText(/support team/)).toBeInTheDocument();
  });

  it('offers a password reset to unlock a locked account', async () => {
    mockApi({ [ME]: { data: makeUser({ status: 'LOCKED' }) } });
    renderWithAuth(<AccountStatusPage />);

    expect(await screen.findByText('Your account is locked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reset my password' })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });

  it('signs the user out and returns them to sign in', async () => {
    mockApi({
      [ME]: { data: makeUser({ status: 'SUSPENDED' }) },
      'POST /api/v1/auth/logout': { data: null },
    });
    renderWithAuth(<AccountStatusPage />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});

describe('route protection', () => {
  const Protected = () => <p>Wholesaler bulk deals</p>;

  it('never renders protected content while the session is unknown', async () => {
    mockApi({ [ME]: { data: makeUser() } });
    renderWithAuth(
      <AuthGuard>
        <Protected />
      </AuthGuard>
    );

    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
    expect(screen.queryByText('Wholesaler bulk deals')).not.toBeInTheDocument();
    expect(await screen.findByText('Wholesaler bulk deals')).toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in, remembering where they wanted to go', async () => {
    setPathname('/bulk-deals');
    mockApi(noSession);
    renderWithAuth(
      <AuthGuard>
        <Protected />
      </AuthGuard>
    );

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/login?redirect=%2Fbulk-deals')
    );
    expect(screen.queryByText('Wholesaler bulk deals')).not.toBeInTheDocument();
  });

  it('treats an expired session the same as being signed out', async () => {
    setPathname('/wallet');
    mockApi({ [ME]: { status: 401, errors: [{ error_code: 'SESSION_EXPIRED' }] } });
    renderWithAuth(
      <AuthGuard>
        <Protected />
      </AuthGuard>
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?redirect=%2Fwallet'));
  });

  it('refuses a signed-in user whose role does not cover the area', async () => {
    mockApi({ [ME]: { data: makeUser({ role: 'consumer' }) } });
    renderWithAuth(
      <AuthGuard roles={['wholesaler']}>
        <Protected />
      </AuthGuard>
    );

    expect(await screen.findByText('This area is not available to you')).toBeInTheDocument();
    expect(screen.getByText(/set up as Consumer/)).toBeInTheDocument();
    expect(screen.queryByText('Wholesaler bulk deals')).not.toBeInTheDocument();
  });

  it('diverts an unverified elevated account to KYC instead of the dashboard', async () => {
    mockApi({ [ME]: { data: retailer({ kyc_status: 'PENDING' }) } });
    renderWithAuth(
      <AuthGuard roles={['retailer']}>
        <Protected />
      </AuthGuard>
    );

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/kyc'));
    expect(screen.queryByText('Wholesaler bulk deals')).not.toBeInTheDocument();
  });

  it('admits an approved account of the right role', async () => {
    mockApi({ [ME]: { data: retailer({ kyc_status: 'APPROVED' }) } });
    renderWithAuth(
      <AuthGuard roles={['retailer']}>
        <Protected />
      </AuthGuard>
    );

    expect(await screen.findByText('Wholesaler bulk deals')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
