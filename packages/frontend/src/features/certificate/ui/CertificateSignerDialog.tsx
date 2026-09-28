import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lmsApi, Course } from '../../../shared/api/lms';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { FormError } from '../../auth/ui/AuthControls';
import { SignerFields } from './SignaturePad';

// Add or replace a course's certificate signer. Certificates already issued keep the signature
// they were issued with; new ones use this.
export const CertificateSignerDialog: React.FC<{
  course: Course | null;
  onClose: () => void;
}> = ({ course, onClose }) => {
  const qc = useQueryClient();
  const [signerName, setSignerName] = useState(course?.certificate?.signerName || '');
  const [signature, setSignature] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      lmsApi.updateCourse(course!.id, {
        certificate: { signerName: signerName.trim(), signature: signature! }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course', course!.id] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['course-certificates', course!.id] });
      onClose();
    }
  });
  const valid = signerName.trim().length >= 2 && !!signature;

  return (
    <Modal
      isOpen={!!course}
      onClose={onClose}
      title="Certificate signature"
      description="Printed on every new completion certificate of this course. Certificates already issued keep their original signature."
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} isLoading={save.isPending} onClick={() => save.mutate()}>
            Save signature
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={(save.error as Error)?.message || null} />
        <SignerFields
          name={signerName}
          onName={setSignerName}
          signature={signature}
          onSignature={setSignature}
        />
      </div>
    </Modal>
  );
};
