@manual @staff
Feature: Staff register invitations and access
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_STAFF_001 @P0
  Scenario: Invite and join a teacher
    Given administrator A has created a staff record with a unique example.test email
    When they invite that email and the recipient signs up, confirms email and redeems the code
    Then the recipient has staff access to School A and appears in its access list

  @TC_STAFF_002 @P0
  Scenario: Private staff documents
    Given administrator A uploaded a fictional qualification file
    When the administrator opens it and a teacher, parent and School B user request the same file
    Then only the authorised administrator can read the private document

  @TC_STAFF_003 @P1
  Scenario: Invitation email binding and reuse
    Given an unused invitation is bound to one email
    When another email attempts redemption and then the intended account redeems the invitation twice
    Then the other email is denied and exactly one membership is created

  @TC_STAFF_004 @P1
  Scenario: Expired invitation
    Given an invitation has an expiry date in the past
    When the intended account redeems it
    Then the code is rejected with a readable error and no membership is created

  @TC_STAFF_005 @P1
  Scenario: Role change
    Given a fictional staff account belongs to School A
    When administrator A changes its role and that user starts a fresh session
    Then navigation and API permissions match the new role without changing School B
