export type AuthTokenResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
  requiresVerification?: false;
};

export type VerificationPendingResponse = {
  requiresVerification: true;
  email: string;
  message: string;
};

export type SignupResponse = AuthTokenResponse | VerificationPendingResponse;
