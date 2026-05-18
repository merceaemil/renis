<#import "template.ftl" as layout>
<@layout.emailLayout>
<p>Hello ${user.firstName!""},</p>
<p>An account has been created for you on RENIS-BI (National Register of Diplomas and Academic Transcripts).</p>
<p>Click the link below to set your password. You will use your email address and this password to sign in.</p>
<p><a href="${link}">Open the platform</a></p>
<p>This invitation link is single-use and valid for 48 hours.</p>
</@layout.emailLayout>
