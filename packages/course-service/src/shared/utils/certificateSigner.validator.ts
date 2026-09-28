import { body } from 'express-validator';

// a small PNG drawn or uploaded in the browser; the 100kb JSON limit caps it anyway
const SIGNATURE = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

// `required`: a new course cannot exist without the signer of its certificates
export const certificateSignerValidators = (required: boolean) => [
  required
    ? body('certificate')
        .isObject()
        .withMessage('certificate (signer name + signature) is required to create a course')
    : body('certificate').optional().isObject().withMessage('certificate must be an object'),
  body('certificate.signerName')
    .if(body('certificate').exists())
    .isString()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('certificate.signerName must be 2-80 characters'),
  body('certificate.signature')
    .if(body('certificate').exists())
    .isString()
    .isLength({ max: 80_000 })
    .matches(SIGNATURE)
    .withMessage('certificate.signature must be a PNG data URL under 60 KB')
];

export const pickSigner = (c?: { signerName: string; signature: string }) =>
  c && { signerName: c.signerName, signature: c.signature };
