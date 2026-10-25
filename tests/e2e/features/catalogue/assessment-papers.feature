@manual @assessment_papers
Feature: Assessment paper authoring review and print
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_PAPER_001 @P0
  Scenario: Draft a complete paper
    Given Teacher A is assigned to Grade 3 A Mathematics
    When they create questions, marks, instructions, answer lines and a fictional image then save and reopen
    Then all content and total marks are preserved

  @TC_PAPER_002 @P0
  Scenario: Return revise and approve
    Given Teacher A saved a draft and selected administrator A as reviewer
    When they submit, receive reviewer feedback, correct and resubmit, and the reviewer approves
    Then feedback and approval are recorded and approved content is fixed

  @TC_PAPER_003 @P1
  Scenario: Separate learner and memorandum printing
    Given an approved paper contains model answers
    When staff print the learner copy and then the memorandum
    Then the learner copy contains questions and answer space without answers and the separate memorandum includes the correct answers

  @TC_PAPER_004 @P1
  Scenario: Create mark capture from paper
    Given an approved paper has a known class, subject, year, term and total
    When the teacher creates its assessment and opens mark capture
    Then the assessment matches the paper and the correct learner grid appears

  @TC_PAPER_005 @P1
  Scenario: Reject incompatible assessment link
    Given a paper and assessment differ in subject or maximum score
    When a user links them
    Then the link is rejected and both remain unchanged

  @TC_PAPER_006 @P1
  Scenario: Revision preserves approved original
    Given an approved paper needs correction
    When its author creates a revised copy
    Then the new draft references the immutable original and can be edited separately

  @TC_PAPER_007 @P1
  Scenario: Reusable template defaults
    Given administrator A creates a template with instructions and layout defaults
    When Teacher A creates a paper using it
    Then defaults apply without copying confidential answers from another paper

  @TC_PAPER_008 @P1
  Scenario: Draft ownership and school isolation
    Given Teacher A owns a draft
    When an unrelated teacher or School B user attempts to edit through UI or API
    Then access is denied and the draft remains unchanged

  @TC_PAPER_009 @P1
  Scenario: Unsaved edits and image validation
    Given a teacher has unsaved paper changes
    When they navigate away and cancel or choose an unsupported image
    Then cancelling keeps the draft and invalid images produce a readable error without being saved
